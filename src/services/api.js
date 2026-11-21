import axios from 'axios';

const STORAGE_KEY = 'catatan-keuangan:transactions';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '');
const client = API_BASE_URL
  ? axios.create({ baseURL: API_BASE_URL, timeout: 5000, headers: { 'Content-Type': 'application/json' } })
  : null;

const readLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Data transaksi lokal tidak valid.');
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Data transaksi lokal rusak dan tidak dapat dibaca.');
    throw error;
  }
};

const writeLocal = (transactions) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  return transactions;
};

const cacheTransaction = (transaction) => {
  if (!transaction || transaction.id == null) return transaction;
  const transactions = readLocal();
  const exists = transactions.some((item) => String(item.id) === String(transaction.id));
  writeLocal(exists
    ? transactions.map((item) => String(item.id) === String(transaction.id) ? transaction : item)
    : [...transactions, transaction]);
  return transaction;
};

const useFallback = (error) => !error.response;
const unwrapList = (data) => {
  const list = Array.isArray(data) ? data : data?.transactions;
  if (!Array.isArray(list)) throw new Error('Respons server tidak berisi daftar transaksi.');
  return list;
};
const unwrapItem = (data) => data?.transaction ?? data;

export async function getTransactions() {
  if (!client) return readLocal();
  try {
    return writeLocal(unwrapList((await client.get('/transactions')).data));
  } catch (error) {
    if (useFallback(error)) return readLocal();
    throw error;
  }
}

export async function getTransactionById(id) {
  if (!client) return readLocal().find((transaction) => String(transaction.id) === String(id)) ?? null;
  try {
    return cacheTransaction(unwrapItem((await client.get(`/transactions/${encodeURIComponent(id)}`)).data));
  } catch (error) {
    if (!useFallback(error)) throw error;
    return readLocal().find((transaction) => String(transaction.id) === String(id)) ?? null;
  }
}

export async function createTransaction(input) {
  const transaction = {
    id: crypto.randomUUID(),
    type: input.type,
    title: input.title.trim(),
    amount: Number(input.amount),
    category: input.category,
    date: input.date,
    note: input.note?.trim() ?? '',
  };
  if (!client) return writeLocal([...readLocal(), transaction]).at(-1);
  try {
    return cacheTransaction(unwrapItem((await client.post('/transactions', transaction)).data) ?? transaction);
  } catch (error) {
    if (!useFallback(error)) throw error;
    return writeLocal([...readLocal(), transaction]).at(-1);
  }
}

export async function updateTransaction(id, changes) {
  const existing = await getTransactionById(id);
  if (!existing) throw new Error('Transaksi tidak ditemukan.');
  const updated = {
    ...existing,
    ...changes,
    id: existing.id,
    amount: Number(changes.amount ?? existing.amount),
    title: (changes.title ?? existing.title).trim(),
    note: (changes.note ?? existing.note ?? '').trim(),
  };
  if (!client) {
    writeLocal(readLocal().map((item) => String(item.id) === String(id) ? updated : item));
    return updated;
  }
  try {
    return cacheTransaction(unwrapItem((await client.put(`/transactions/${encodeURIComponent(id)}`, updated)).data) ?? updated);
  } catch (error) {
    if (!useFallback(error)) throw error;
    const transactions = readLocal();
    const exists = transactions.some((item) => String(item.id) === String(id));
    writeLocal(exists
      ? transactions.map((item) => String(item.id) === String(id) ? updated : item)
      : [...transactions, updated]);
    return updated;
  }
}

export async function deleteTransaction(id) {
  if (!client) return writeLocal(readLocal().filter((item) => String(item.id) !== String(id)));
  try {
    await client.delete(`/transactions/${encodeURIComponent(id)}`);
    return writeLocal(readLocal().filter((item) => String(item.id) !== String(id)));
  } catch (error) {
    if (!useFallback(error)) throw error;
    return writeLocal(readLocal().filter((item) => String(item.id) !== String(id)));
  }
}

export async function resetMonthTransactions(year = new Date().getFullYear(), month = new Date().getMonth()) {
  const transactions = await getTransactions();
  const remaining = transactions.filter((item) => {
    const [itemYear, itemMonth] = (item.date ?? '').slice(0, 10).split('-').map(Number);
    return itemYear !== year || itemMonth !== month + 1;
  });
  if (client) {
    try {
      const monthIds = transactions
        .filter((item) => !remaining.some((entry) => String(entry.id) === String(item.id)))
        .map((item) => item.id);
      await Promise.all(monthIds.map((id) => client.delete(`/transactions/${encodeURIComponent(id)}`)));
      return writeLocal(remaining);
    } catch (error) {
      if (!useFallback(error)) throw error;
    }
  }
  return writeLocal(remaining);
}

export async function resetAllTransactions() {
  if (client) {
    try {
      await client.delete('/transactions');
      return writeLocal([]);
    } catch (error) {
      if (!useFallback(error)) throw error;
    }
  }
  return writeLocal([]);
}
