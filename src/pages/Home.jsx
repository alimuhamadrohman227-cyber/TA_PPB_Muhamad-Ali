import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import PageHeading from '../components/PageHeading.jsx';
import TransactionListItem from '../components/TransactionListItem.jsx';
import { getTransactions } from '../services/api.js';
import { currency, isSameMonth, monthLabel } from '../utils/format.js';

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());

  useEffect(() => {
    getTransactions()
      .then(setTransactions)
      .catch((cause) => setError(cause.message || 'Data transaksi gagal dimuat.'));
  }, []);

  const monthTransactions = transactions.filter((item) => isSameMonth(item.date, selectedMonth));
  const income = monthTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = monthTransactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = income - expense;
  const status = balance > 0 ? 'Surplus' : balance < 0 ? 'Defisit' : 'Netral';
  const latestTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <main className="page-pad">
      <PageHeading
        title="Catatan Keuangan"
        subtitle="DASHBOARD"
        action={
          <label className="relative flex cursor-pointer items-center gap-1 rounded-full border border-[#E9EAE7] bg-white px-3 py-2 text-[11px] font-semibold text-[#48534B]">
            <CalendarDays size={14} />
            {monthLabel(selectedMonth)}
            <ChevronDown size={13} />
            <input
              type="month"
              aria-label="Pilih bulan dan tahun"
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={(event) => {
                if (event.target.value) setSelectedMonth(new Date(`${event.target.value}-01T00:00:00`));
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        }
      />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}

      <div className="flex flex-col space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-[#24332C] p-5 text-white shadow-xl shadow-[#24332C]/10">
        <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full border-[28px] border-white/[0.04]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-white/70">Sisa Saldo</p>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${balance > 0 ? 'bg-[#DCFCE7] text-[#16A34A]' : balance < 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-white/15 text-white'}`}>
              {status}
            </span>
          </div>
          <p className="mt-3 text-[32px] font-bold tracking-tight">{currency(balance)}</p>
          <p className="mt-1 text-[11px] text-white/55">{monthLabel(selectedMonth)}</p>
          <div className="my-5 h-px bg-white/10" />
          <div className="flex flex-col gap-3">
            <Link to="/pemasukan" className="flex items-center gap-2.5 rounded-xl transition hover:bg-white/5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-[#B8E9BE]"><ArrowDownLeft size={17} /></span>
              <span><span className="block text-[10px] text-white/55">Pemasukan</span><span className="mt-0.5 block text-xs font-bold">{currency(income)}</span></span>
            </Link>
            <Link to="/pengeluaran" className="flex items-center gap-2.5 rounded-xl transition hover:bg-white/5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-[#FFB5A8]"><ArrowUpRight size={17} /></span>
              <span><span className="block text-[10px] text-white/55">Pengeluaran</span><span className="mt-0.5 block text-xs font-bold">{currency(expense)}</span></span>
            </Link>
          </div>
          <Link to="/rekap" className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-xs font-semibold transition hover:bg-white/15">
            Lihat Rekap Keuangan <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Aktivitas</p>
            <h2 className="mt-1 text-lg font-bold">Transaksi Terbaru</h2>
          </div>
          {transactions.length > 5 && (
            <Link to="/pengeluaran" className="flex items-center gap-1 text-[11px] font-semibold text-[#637267]">
              Pengeluaran <ChevronRight size={14} />
            </Link>
          )}
        </div>
        <div className="card px-4">
          {latestTransactions.length ? (
            <>
              {latestTransactions.map((item) => <TransactionListItem key={item.id} transaction={item} />)}
              <div className="flex items-center justify-center gap-1.5 border-t border-[#F1F1EF] py-3 text-[10px] text-[#939892]">
                <Clock3 size={13} /> Lima transaksi terakhir
              </div>
            </>
          ) : (
            <div className="py-3">
              <EmptyState title="Belum ada transaksi" description="Transaksi yang kamu catat akan tampil di sini." />
            </div>
          )}
        </div>
      </section>
      </div>
    </main>
  );
}
