import { useMemo, useState } from 'react';
import { ArrowDownLeft, Search, TrendingUp } from 'lucide-react';
import AnimatedCurrency from '../components/AnimatedCurrency.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import { ListSkeleton, SummarySkeleton } from '../components/LoadingSkeleton.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionGroupList from '../components/TransactionGroupList.jsx';
import useTransactions from '../hooks/useTransactions.js';
import { isSameMonth, monthLabel } from '../utils/format.js';

const periods = [
  { value: 'Harian', label: 'Harian' },
  { value: 'Mingguan', label: 'Mingguan' },
  { value: 'Bulanan', label: 'Bulanan' },
];

export default function Pemasukan() {
  const { transactions, loading, error } = useTransactions();
  const [period, setPeriod] = useState('Bulanan');
  const [search, setSearch] = useState('');
  const [now] = useState(() => new Date());
  const allIncomes = useMemo(() =>
    transactions.filter((item) => item.type === 'income'),
  [transactions]);
  const incomes = useMemo(() =>
    allIncomes
      .filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase())),
  [allIncomes, search]);
  const currentTotal = allIncomes.filter((item) => isSameMonth(item.date, now)).reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <main className="page-pad has-fab-content">
      <PageHeading title="Pemasukan" subtitle="UANG MASUK" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      {loading ? <SummarySkeleton /> : <section className="card motion-enter overflow-hidden p-card">
        <div className="flex items-start justify-between"><div><p className="caption">Total pemasukan bulan ini</p><p className="money mt-2 text-[27px] font-bold tracking-tight text-[#24332C]"><AnimatedCurrency amount={currentTotal} /></p><p className="caption mt-1">{monthLabel(now)}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#DCFCE7] text-[#16A34A]"><TrendingUp size={21} /></span></div>
        <div className="caption tabular-nums mt-5 flex items-center gap-2 rounded-xl bg-[#F4F8F3] px-3 py-2.5 text-[#4C7255]"><ArrowDownLeft size={15} /> {allIncomes.length} sumber pemasukan tercatat</div>
      </section>}
      <section className="mt-section">
        <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Riwayat</p><h2 className="section-title mt-1.5">Daftar Pemasukan</h2></div><span className="caption tabular-nums">{incomes.length} transaksi</span></div>
        <LiquidSegmentedControl options={periods} value={period} onChange={setPeriod} className="mb-4 w-full" />
        <label className="mb-3 flex items-center gap-2.5 rounded-2xl border border-[#EFEFED] bg-white px-4">
          <Search size={16} className="text-[#9A9F9A]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari pemasukan..."
            className="w-full bg-transparent py-3 text-xs outline-none placeholder:text-[#6B7280]"
          />
        </label>
        {loading ? <ListSkeleton /> : search && !incomes.length ? (
          <EmptyState title="Tidak ditemukan" description="Coba kata kunci lain." actionLabel="Catat Pemasukan" actionType="income" />
        ) : (
          <TransactionGroupList
            period={period}
            transactions={incomes}
            type="income"
            title="Daftar Pemasukan"
            emptyDescription="Catat sumber pemasukanmu melalui tombol + di bawah."
            actionLabel="Catat Pemasukan"
          />
        )}
      </section>
    </main>
  );
}
