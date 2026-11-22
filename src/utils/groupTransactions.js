import { getDaysInMonth, getWeekOfMonth, parseYMD } from './helpers.js';

const sortTransactions = (items) => [...items].sort((a, b) => {
  const dateA = String(a.date || '').slice(0, 10);
  const dateB = String(b.date || '').slice(0, 10);
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  const createdA = String(a.created_at || '');
  const createdB = String(b.created_at || '');
  if (createdA !== createdB) return createdB.localeCompare(createdA);
  return String(b.id || '').localeCompare(String(a.id || ''));
});

const withMeta = (items) => {
  const sorted = sortTransactions(items);
  return {
    items: sorted,
    total: sorted.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    count: sorted.length,
  };
};

export const groupByDay = (transactions) => {
  const groups = new Map();
  transactions.forEach((transaction) => {
    const parsed = parseYMD(transaction.date);
    if (!parsed) return;
    const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(transaction);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({ key, ...parseYMD(key), ...withMeta(items) }));
};

export const groupByWeek = (transactions) => {
  const months = new Map();
  transactions.forEach((transaction) => {
    const parsed = parseYMD(transaction.date);
    if (!parsed) return;
    const monthKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const monthWeeks = months.get(monthKey);
    const week = getWeekOfMonth(parsed.day);
    const weekKey = `${monthKey}-W${week}`;
    if (!monthWeeks.has(weekKey)) monthWeeks.set(weekKey, []);
    monthWeeks.get(weekKey).push(transaction);
  });

  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, weekMap]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthItems = [...weekMap.values()].flat();
      const weeks = [...weekMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, items]) => {
          const week = Number(key.split('-W')[1]);
          const start = (week - 1) * 7 + 1;
          const end = Math.min(week * 7, getDaysInMonth(year, month));
          return { key, week, start, end, year, month, ...withMeta(items) };
        });
      return { key: monthKey, year, month, weeks, ...withMeta(monthItems) };
    });
};

export const groupByMonth = (transactions) => {
  const years = new Map();
  transactions.forEach((transaction) => {
    const parsed = parseYMD(transaction.date);
    if (!parsed) return;
    if (!years.has(parsed.year)) years.set(parsed.year, new Map());
    const yearMonths = years.get(parsed.year);
    const monthKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
    if (!yearMonths.has(monthKey)) yearMonths.set(monthKey, []);
    yearMonths.get(monthKey).push(transaction);
  });

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, monthMap]) => {
      const monthItems = [...monthMap.values()].flat();
      const months = [...monthMap.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, items]) => {
          const month = Number(key.split('-')[1]);
          return { key, year, month, ...withMeta(items) };
        });
      return { key: String(year), year, months, ...withMeta(monthItems) };
    });
};
