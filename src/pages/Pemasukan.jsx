import { useEffect, useState } from 'react';
import { ArrowDownLeft, TrendingUp } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionListItem from '../components/TransactionListItem.jsx';
import { getTransactions } from '../services/api.js';
import { currency, isSameMonth, monthLabel } from '../utils/format.js';

export default function Pemasukan() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [now] = useState(() => new Date());
  useEffect(() => {
    getTransactions().then(setTransactions).catch((cause) => setError(cause.message || 'Data transaksi gagal dimuat.'));
  }, []);
  const incomes = transactions.filter((item) => item.type === 'income').sort((a, b) => b.date.localeCompare(a.date));
  const currentTotal = incomes.filter((item) => isSameMonth(item.date, now)).reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <main className="page-pad">
      <PageHeading title="Pemasukan" subtitle="UANG MASUK" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
      <section className="card overflow-hidden p-5">
        <div className="flex items-start justify-between"><div><p className="text-xs text-[#858A85]">Total pemasukan bulan ini</p><p className="mt-2 text-[27px] font-bold tracking-tight text-[#24332C]">{currency(currentTotal)}</p><p className="mt-1 text-[11px] text-[#929792]">{monthLabel(now)}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#DCFCE7] text-[#16A34A]"><TrendingUp size={21} /></span></div>
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#F4F8F3] px-3 py-2.5 text-[11px] text-[#4C7255]"><ArrowDownLeft size={15} /> {incomes.length} sumber pemasukan tercatat</div>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Riwayat</p><h2 className="mt-1 text-lg font-bold">Sumber Pemasukan</h2></div><span className="text-[11px] text-[#858A85]">{incomes.length} transaksi</span></div>
        <div className="card px-4">{incomes.length ? incomes.map((item) => <TransactionListItem key={item.id} transaction={item} />) : <div className="py-3"><EmptyState title="Belum ada pemasukan" description="Catat sumber pemasukanmu melalui tombol + di bawah." /></div>}</div>
      </section>
    </main>
  );
}
