export const currency = (amount) =>
  `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(Number(amount) || 0))}`;

export const localDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const formatDate = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  const date = parseLocalDate(value);
  return date ? new Intl.DateTimeFormat('id-ID', options).format(date) : '-';
};

export const monthLabel = (date) =>
  new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);

export const isSameMonth = (value, reference = new Date()) => {
  const date = parseLocalDate(value);
  return Boolean(date && date.getMonth() === reference.getMonth() && date.getFullYear() === reference.getFullYear());
};

export const transactionIcon = (category = '') => {
  const value = category.toLowerCase();
  if (value.includes('makan')) return 'food';
  if (value.includes('belanja') || value.includes('shopee')) return 'shopping';
  if (value.includes('transport') || value.includes('parkir')) return 'transport';
  if (value.includes('tagihan')) return 'bill';
  return 'other';
};
