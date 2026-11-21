import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingDown } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionListItem from '../components/TransactionListItem.jsx';
import { getTransactions } from '../services/api.js';
import { currency, isSameMonth, localDateString, parseLocalDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

const periods = [
  { value: 'Harian', label: 'Harian' },
  { value: 'Mingguan', label: 'Mingguan' },
  { value: 'Bulanan', label: 'Bulanan' },
];

export default function Pengeluaran() {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState('Bulanan');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [now] = useState(() => new Date());

  useEffect(() => {
    getTransactions()
      .then(setTransactions)
      .catch((cause) => setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.')));
  }, []);

  const monthExpenses = transactions
    .filter((item) => item.type === 'expense' && isSameMonth(item.date, now))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = useMemo(() => {
    let result = transactions.filter((item) => item.type === 'expense');
    if (period === 'Bulanan') result = result.filter((item) => isSameMonth(item.date, now));
    if (period === 'Harian') result = result.filter((item) => item.date === localDateString(now));
    if (period === 'Mingguan') {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      result = result.filter((item) => {
        const date = parseLocalDate(item.date);
        return date && date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && date <= now;
      });
    }
    return result
      .filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, period, now, search]);

  return (
    <main className="page-pad">
      <PageHeading title="Pengeluaran" subtitle="UANG KELUAR" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

      <section className="card overflow-hidden p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[#858A85]">Total pengeluaran bulan ini</p>
            <p className="mt-2 text-[27px] font-bold tracking-tight text-[#24332C]">{currency(monthExpenses)}</p>
            <p className="mt-1 text-[11px] text-[#929792]">
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)}
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]"><TrendingDown size={21} /></span>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Aktivitas</p>
            <h2 className="mt-1 text-lg font-bold">Daftar Pengeluaran</h2>
          </div>
          <span className="text-[11px] text-[#858A85]">{expenses.length} transaksi</span>
        </div>
        <LiquidSegmentedControl options={periods} value={period} onChange={setPeriod} className="mb-4 w-full" />
        <label className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[#EFEFED] bg-white px-4">
          <Search size={16} className="text-[#9A9F9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari pengeluaran..."
            className="w-full bg-transparent py-3 text-xs outline-none placeholder:text-[#A5AAA5]"
          />
        </label>
        <div className="card px-4">
          {expenses.length ? expenses.map((item) => (
            <TransactionListItem key={item.id} transaction={item} />
          )) : (
            <div className="py-3">
              <EmptyState
                title={search ? 'Tidak ditemukan' : 'Belum ada catatan pengeluaran'}
                description={search ? 'Coba kata kunci lain.' : 'Tekan tombol + di bawah untuk mulai mencatat.'}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
