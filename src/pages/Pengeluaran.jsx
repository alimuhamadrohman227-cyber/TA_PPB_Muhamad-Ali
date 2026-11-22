import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingDown } from 'lucide-react';
import AnimatedCurrency from '../components/AnimatedCurrency.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import { ListSkeleton, SummarySkeleton } from '../components/LoadingSkeleton.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionGroupList from '../components/TransactionGroupList.jsx';
import { getTransactions } from '../services/api.js';
import { isSameMonth } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

const periods = [
  { value: 'Harian', label: 'Harian' },
  { value: 'Mingguan', label: 'Mingguan' },
  { value: 'Bulanan', label: 'Bulanan' },
];

export default function Pengeluaran() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Bulanan');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [now] = useState(() => new Date());

  useEffect(() => {
    getTransactions()
      .then(setTransactions)
      .catch((cause) => setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.')))
      .finally(() => setLoading(false));
  }, []);

  const monthExpenses = transactions
    .filter((item) => item.type === 'expense' && isSameMonth(item.date, now))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = useMemo(() =>
    transactions
      .filter((item) => item.type === 'expense')
      .filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase())),
  [transactions, search]);

  return (
    <main className="page-pad has-fab-content">
      <PageHeading title="Pengeluaran" subtitle="UANG KELUAR" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

      {loading ? <SummarySkeleton /> : <section className="card motion-enter overflow-hidden p-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="caption">Total pengeluaran bulan ini</p>
            <p className="money mt-2 text-[27px] font-bold tracking-tight text-[#24332C]"><AnimatedCurrency amount={monthExpenses} /></p>
            <p className="caption mt-1">
              {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)}
            </p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]"><TrendingDown size={21} /></span>
        </div>
      </section>}

      <section className="mt-section">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">Aktivitas</p>
            <h2 className="section-title mt-1.5">Daftar Pengeluaran</h2>
          </div>
          <span className="caption tabular-nums">{expenses.length} transaksi</span>
        </div>
        <LiquidSegmentedControl options={periods} value={period} onChange={setPeriod} className="mb-4 w-full" />
        <label className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[#EFEFED] bg-white px-4">
          <Search size={16} className="text-[#9A9F9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari pengeluaran..."
            className="w-full bg-transparent py-3 text-xs outline-none placeholder:text-[#6B7280]"
          />
        </label>
        {loading ? <ListSkeleton /> : search && !expenses.length ? (
          <EmptyState title="Tidak ditemukan" description="Coba kata kunci lain." actionLabel="Catat Pengeluaran" actionType="expense" />
        ) : (
          <TransactionGroupList
            period={period}
            transactions={expenses}
            type="expense"
            title="Daftar Pengeluaran"
            emptyDescription="Tekan tombol + di bawah untuk mulai mencatat."
            actionLabel="Catat Pengeluaran"
          />
        )}
      </section>
    </main>
  );
}
