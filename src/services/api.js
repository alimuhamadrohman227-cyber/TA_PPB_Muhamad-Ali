import axios from 'axios';
import {
  clearUserTransactions,
  discardFailedOutboxAndMergeServer,
  discardLocalPeriodChanges,
  deleteUserDatabase,
  getLocalTransaction,
  getLocalTransactions,
  mergeServerTransactions,
  queueLocalChange,
} from './offlineStore.js';
import { publishTransactionsUpdate } from './transactionEvents.js';
import {
  configureSync,
  queueChanged,
  refreshSyncStatus,
  reportSyncError,
  syncPendingTransactions,
} from './sync.js';

export const TOKEN_KEY = 'ck:token';
export const USER_KEY = 'ck:user';
const LEGACY_TRANSACTIONS_KEY = 'catatan-keuangan:transactions';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
const localDataRevisions = new Map();
const refreshSequences = new Map();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const responseMessage = error?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  const message = error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user && user.id ? { ...user, id: String(user.id) } : null;
  } catch {
    return null;
  }
}

export function clearAuthStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_TRANSACTIONS_KEY);
    localStorage.removeItem('catatan-keuangan:profile-name');
  } catch {
    // Session state will still be cleared in memory.
  }
}

export function storeAuthSession(token, user) {
  if (!token || !user) throw new Error('Respons autentikasi tidak berisi token atau data pengguna.');
  try {
    localStorage.removeItem(LEGACY_TRANSACTIONS_KEY);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    clearAuthStorage();
    throw new Error('Sesi tidak dapat disimpan di perangkat ini.');
  }
}

apiClient.interceptors.request.use((config) => {
  if (!API_BASE_URL) {
    return Promise.reject(new Error('VITE_API_BASE_URL belum dikonfigurasi.'));
  }
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([401, 403].includes(error.response?.status)) {
      clearAuthStorage();
      if (typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') throw new Error('Respons server tidak berisi data pengguna.');
  return {
    id: String(user.id ?? ''),
    name: String(user.name ?? ''),
    email: String(user.email ?? ''),
    avatar: user.avatar ?? null,
  };
};

const unwrapAuthSession = (data) => {
  if (!data?.token) throw new Error('Respons server tidak berisi token autentikasi.');
  return { token: data.token, user: normalizeUser(data.user) };
};

export async function loginRequest(credentials) {
  const { data } = await apiClient.post('/auth/login', {
    email: String(credentials.email ?? '').trim().toLowerCase(),
    password: credentials.password,
  });
  return unwrapAuthSession(data);
}

export async function registerRequest(credentials) {
  const { data } = await apiClient.post('/auth/register', {
    name: String(credentials.name ?? '').trim(),
    email: String(credentials.email ?? '').trim().toLowerCase(),
    password: credentials.password,
  });
  return unwrapAuthSession(data);
}

export async function getCurrentUser() {
  const { data } = await apiClient.get('/auth/me');
  return normalizeUser(data?.user);
}

export async function updateCurrentUserProfile(profile) {
  const { data } = await apiClient.put('/auth/profile', {
    name: String(profile.name ?? '').trim(),
    ...(profile.avatar !== undefined ? { avatar: profile.avatar } : {}),
  });
  return normalizeUser(data?.user);
}

export async function changePassword({ oldPassword, newPassword }) {
  const { data } = await apiClient.put('/auth/change-password', { oldPassword, newPassword });
  return data;
}

function normalizeExpenseLimits(limits) {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) {
    throw new Error('Respons server tidak berisi limit pengeluaran yang valid.');
  }
  return Object.fromEntries(Object.entries(limits).map(([category, amount]) => {
    const value = Number(amount);
    if (!category || !Number.isInteger(value) || value <= 0) {
      throw new Error('Data limit pengeluaran dari server tidak valid.');
    }
    return [category, value];
  }));
}

export async function getExpenseLimits() {
  const { data } = await apiClient.get('/expense-limits');
  return normalizeExpenseLimits(data?.limits);
}

export async function updateExpenseLimits(limits) {
  const { data } = await apiClient.put('/expense-limits', { limits });
  return normalizeExpenseLimits(data?.limits);
}

export const normalizeTransaction = (transaction) => {
  if (!transaction || typeof transaction !== 'object') {
    throw new Error('Data transaksi dari server tidak valid.');
  }
  const amount = Number(transaction.amount);
  if (!transaction.id || !['income', 'expense'].includes(transaction.type) || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Data transaksi dari server tidak valid.');
  }
  const date = transaction.date instanceof Date
    ? transaction.date.toISOString().slice(0, 10)
    : String(transaction.date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal transaksi dari server tidak valid.');
  return {
    id: String(transaction.id ?? ''),
    user_id: String(transaction.user_id ?? ''),
    type: transaction.type,
    amount,
    title: String(transaction.title ?? ''),
    category: String(transaction.category ?? ''),
    date,
    note: String(transaction.note ?? ''),
    created_at: transaction.created_at ?? null,
    _syncPending: transaction._syncPending === true,
    serverConfirmed: transaction.serverConfirmed === true
      || (transaction.serverConfirmed !== false && transaction._syncPending !== true),
  };
};

const transactionPayload = (transaction) => ({
  type: transaction.type,
  amount: Number(transaction.amount),
  title: String(transaction.title ?? '').trim(),
  category: String(transaction.category ?? '').trim(),
  date: String(transaction.date ?? '').slice(0, 10),
  note: String(transaction.note ?? '').trim(),
});

async function getTransactionsFromServer() {
  const { data } = await apiClient.get('/transactions');
  if (!Array.isArray(data)) throw new Error('Respons server tidak berisi daftar transaksi.');
  return data.map(normalizeTransaction);
}

function markLocalDataChanged(userId) {
  localDataRevisions.set(userId, (localDataRevisions.get(userId) ?? 0) + 1);
}

async function refreshTransactionsForUser(userId) {
  const revision = localDataRevisions.get(userId) ?? 0;
  const sequence = (refreshSequences.get(userId) ?? 0) + 1;
  refreshSequences.set(userId, sequence);
  const serverTransactions = await getTransactionsFromServer();
  const merged = await mergeServerTransactions(
    userId,
    serverTransactions,
    () => revision === (localDataRevisions.get(userId) ?? 0)
      && sequence === refreshSequences.get(userId),
  );
  publishTransactionsUpdate(userId, merged);
  return merged;
}

function getUserIdOrThrow() {
  const userId = getStoredUser()?.id;
  if (!userId) throw new Error('Sesi pengguna tidak tersedia untuk data offline.');
  return userId;
}

export async function getTransactions() {
  const userId = getUserIdOrThrow();
  const localTransactions = await getLocalTransactions(userId);
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    void refreshTransactionsForUser(userId).catch((cause) => reportSyncError(userId, cause));
  }
  return localTransactions;
}

export async function getTransactionById(id) {
  const userId = getUserIdOrThrow();
  const transaction = await getLocalTransaction(userId, String(id));
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    void refreshTransactionsForUser(userId).catch((cause) => reportSyncError(userId, cause));
  }
  return transaction;
}

export async function createTransaction(input) {
  const userId = getUserIdOrThrow();
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Perangkat ini tidak mendukung pembuatan ID transaksi offline.');
  }
  const id = globalThis.crypto.randomUUID();
  const transaction = normalizeTransaction({
    ...transactionPayload(input),
    id,
    user_id: userId,
    created_at: new Date().toISOString(),
    _syncPending: true,
    serverConfirmed: false,
  });
  await queueLocalChange(userId, 'create', id, transaction);
  markLocalDataChanged(userId);
  const transactions = await getLocalTransactions(userId);
  publishTransactionsUpdate(userId, transactions);
  await queueChanged(userId);
  return transaction;
}

export async function updateTransaction(id, changes) {
  const userId = getUserIdOrThrow();
  const existing = await getLocalTransaction(userId, String(id));
  if (!existing) throw new Error('Transaksi tidak ditemukan.');
  const updated = normalizeTransaction({
    ...existing,
    ...transactionPayload({ ...existing, ...changes }),
    id: String(id),
    _syncPending: true,
    serverConfirmed: existing.serverConfirmed === true
      || (existing.serverConfirmed === undefined && existing._syncPending !== true),
  });
  await queueLocalChange(userId, 'update', String(id), updated);
  markLocalDataChanged(userId);
  const transactions = await getLocalTransactions(userId);
  publishTransactionsUpdate(userId, transactions);
  await queueChanged(userId);
  return updated;
}

export async function deleteTransaction(id) {
  const userId = getUserIdOrThrow();
  const normalizedId = String(id);
  const existing = await getLocalTransaction(userId, normalizedId);
  await queueLocalChange(userId, 'delete', normalizedId, existing);
  markLocalDataChanged(userId);
  const transactions = await getLocalTransactions(userId);
  publishTransactionsUpdate(userId, transactions);
  await queueChanged(userId);
  return { message: 'Transaksi berhasil dihapus.' };
}

function assertOnlineForReset() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Butuh koneksi internet untuk menghapus data sekaligus');
  }
}

export async function resetMonthTransactions(year, month) {
  assertOnlineForReset();
  const userId = getUserIdOrThrow();
  await syncPendingTransactions(userId, { retryFailed: true, force: true });
  let params;
  if (year === undefined) {
    const now = new Date();
    params = { year: now.getFullYear(), month: now.getMonth() + 1 };
  } else {
    params = { year, ...(month !== undefined ? { month } : {}) };
  }
  const { data } = await apiClient.delete('/transactions/reset/monthly', {
    params,
  });
  markLocalDataChanged(userId);
  await discardLocalPeriodChanges(userId, params.year, params.month);
  publishTransactionsUpdate(userId, await getLocalTransactions(userId));
  await refreshSyncStatus(userId);
  return data;
}

export async function resetAllTransactions() {
  assertOnlineForReset();
  const userId = getUserIdOrThrow();
  await syncPendingTransactions(userId, { retryFailed: true, force: true });
  const { data } = await apiClient.delete('/transactions/reset/all');
  markLocalDataChanged(userId);
  await clearUserTransactions(userId);
  publishTransactionsUpdate(userId, []);
  await refreshSyncStatus(userId);
  return data;
}

export async function discardFailedChanges() {
  assertOnlineForReset();
  const userId = getUserIdOrThrow();
  markLocalDataChanged(userId);
  const serverTransactions = await getTransactionsFromServer();
  const result = await discardFailedOutboxAndMergeServer(userId, serverTransactions);
  publishTransactionsUpdate(userId, result.transactions);
  await refreshSyncStatus(userId);
  return result.count;
}

configureSync({
  getActiveUserId: () => getStoredUser()?.id ?? '',
  sendItem: async (item, userId) => {
    const createOnServer = async () => {
      const { data, status } = await apiClient.post('/transactions', {
        ...transactionPayload(item.payload),
        id: item.transactionId,
      });
      const created = normalizeTransaction(data);
      if (created.id !== item.transactionId) {
        const error = new Error('Backend belum mempertahankan ID transaksi lokal. Deploy ulang backend sebelum sinkronisasi.');
        error.response = { status: 409, data: { message: error.message } };
        throw error;
      }
      markLocalDataChanged(userId);
      return { transaction: created, status };
    };

    if (item.op === 'create' || item.payload?.serverConfirmed === false) {
      return createOnServer();
    }
    if (item.op === 'update') {
      try {
        const { data, status } = await apiClient.put(
          `/transactions/${encodeURIComponent(item.transactionId)}`,
          transactionPayload(item.payload),
        );
        const updated = normalizeTransaction(data);
        markLocalDataChanged(userId);
        return { transaction: updated, status };
      } catch (error) {
        if (error?.response?.status !== 404) throw error;
        console.debug('[sync] update 404, mencoba POST', {
          op: 'update',
          id: item.transactionId,
          status: 404,
        });
        return createOnServer();
      }
    }
    try {
      const { status } = await apiClient.delete(`/transactions/${encodeURIComponent(item.transactionId)}`);
      markLocalDataChanged(userId);
      return { transaction: null, status };
    } catch (error) {
      if (error?.response?.status === 404) {
        markLocalDataChanged(userId);
        return { transaction: null, status: 404 };
      }
      throw error;
    }
  },
  refreshTransactions: refreshTransactionsForUser,
  publishTransactions: async (userId, transactions) => {
    const current = transactions ?? await getLocalTransactions(userId);
    publishTransactionsUpdate(userId, current);
  },
  getErrorMessage: (error) => getApiErrorMessage(error),
});

export async function deleteUserOfflineData(userId) {
  await deleteUserDatabase(userId);
}
