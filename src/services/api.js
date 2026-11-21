import axios from 'axios';

export const TOKEN_KEY = 'ck:token';
export const USER_KEY = 'ck:user';
const LEGACY_TRANSACTIONS_KEY = 'catatan-keuangan:transactions';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const message = error?.response?.data?.message ?? error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
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

export async function getTransactions() {
  const { data } = await apiClient.get('/transactions');
  if (!Array.isArray(data)) throw new Error('Respons server tidak berisi daftar transaksi.');
  return data.map(normalizeTransaction);
}

export async function getTransactionById(id) {
  const transactions = await getTransactions();
  return transactions.find((transaction) => transaction.id === String(id)) ?? null;
}

export async function createTransaction(input) {
  const { data } = await apiClient.post('/transactions', transactionPayload(input));
  return normalizeTransaction(data);
}

export async function updateTransaction(id, changes) {
  const existing = await getTransactionById(id);
  if (!existing) throw new Error('Transaksi tidak ditemukan.');
  const { data } = await apiClient.put(
    `/transactions/${encodeURIComponent(id)}`,
    transactionPayload({ ...existing, ...changes }),
  );
  return normalizeTransaction(data);
}

export async function deleteTransaction(id) {
  const { data } = await apiClient.delete(`/transactions/${encodeURIComponent(id)}`);
  return data;
}

export async function resetMonthTransactions(year = new Date().getFullYear(), month = new Date().getMonth()) {
  const { data } = await apiClient.delete('/transactions/reset/monthly', {
    params: { year, month: month + 1 },
  });
  return data;
}

export async function resetAllTransactions() {
  const { data } = await apiClient.delete('/transactions/reset/all');
  return data;
}
