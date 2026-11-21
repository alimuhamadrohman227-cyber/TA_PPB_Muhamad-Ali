import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Download, RotateCcw, ShieldAlert } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import PageHeading from '../components/PageHeading.jsx';
import { getTransactions, resetAllTransactions, resetMonthTransactions } from '../services/api.js';
import { currency, monthLabel, parseLocalDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const periods = [
  { value: 'Bulanan', label: 'Bulanan' },
  { value: 'Tahunan', label: 'Tahunan' },
  { value: 'Semua', label: 'Semua' },
];

export default function Rekap() {
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState('Bulanan');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [error, setError] = useState('');
  useEffect(() => {
    getTransactions().then(setTransactions).catch((cause) => setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.')));
  }, []);

  const filtered = useMemo(() => transactions.filter((item) => {
    if (period === 'Semua') return true;
    const date = parseLocalDate(item.date);
    if (!date) return false;
    return period === 'Tahunan'
      ? date.getFullYear() === selectedMonth.getFullYear()
      : date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
  }), [transactions, period, selectedMonth]);
  const income = filtered.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = filtered.filter((item) => item.type === 'expense');
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = income - expenseTotal;
  const usage = income > 0 ? Math.round((expenseTotal / income) * 100) : 0;
  const categoryRows = Object.entries(expenses.reduce((result, item) => {
    const category = item.category || 'Lainnya';
    result[category] ??= { count: 0, amount: 0 };
    result[category].count += 1;
    result[category].amount += Number(item.amount);
    return result;
  }, {})).map(([category, values]) => ({ category, ...values })).sort((a, b) => b.amount - a.amount);
  const exportCsv = () => {
    const rows = [['id', 'type', 'title', 'amount', 'category', 'date', 'note'], ...transactions.map(({ id, type, title, amount, category, date, note }) => [id, type, title, amount, category, date, note])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'catatan-keuangan.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const resetMonth = async () => {
    if (!window.confirm(`Hapus seluruh transaksi bulan ${monthLabel(selectedMonth)}?`)) return;
    try {
      await resetMonthTransactions(selectedMonth.getFullYear(), selectedMonth.getMonth());
      setTransactions(await getTransactions());
      setError('');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Data bulan ini gagal dihapus.'));
    }
  };
  const resetAll = async () => {
    if (!window.confirm('Hapus SEMUA transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await resetAllTransactions();
      setTransactions([]);
      setError('');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Semua data gagal dihapus.'));
    }
  };
  const shiftMonth = (difference) => setSelectedMonth((current) => new Date(
    current.getFullYear() + (period === 'Tahunan' ? difference : 0),
    current.getMonth() + (period === 'Tahunan' ? 0 : difference),
    1,
  ));

  return (
    <main className="page-pad">
      <PageHeading title="Rekap Keuangan" subtitle="ANALISIS & KELOLA DATA" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      <LiquidSegmentedControl options={periods} value={period} onChange={setPeriod} className="mb-4 w-full" />
      {period !== 'Semua' && <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#EFEFED] bg-white px-3 py-2"><button onClick={() => shiftMonth(-1)} aria-label="Periode sebelumnya" className="grid h-8 w-8 place-items-center rounded-full text-[#59635C]"><ArrowLeft size={17} /></button><span className="text-xs font-semibold text-[#38423B]">{period === 'Tahunan' ? selectedMonth.getFullYear() : monthLabel(selectedMonth)}</span><button onClick={() => shiftMonth(1)} aria-label="Periode berikutnya" className="grid h-8 w-8 place-items-center rounded-full text-[#59635C]"><ArrowRight size={17} /></button></div>}
      <div className="flex flex-col space-y-6">
      <section className="rounded-[28px] bg-[#24332C] p-5 text-white shadow-xl shadow-[#24332C]/10">
        <p className="text-xs text-white/65">Ringkasan {period === 'Semua' ? 'semua periode' : period === 'Tahunan' ? selectedMonth.getFullYear() : monthLabel(selectedMonth)}</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs text-white/75"><ArrowDownLeft size={16} className="text-[#B9E6BC]" /> Total Pemasukan</span><strong className="text-sm">{currency(income)}</strong></div>
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs text-white/75"><ArrowUpRight size={16} className="text-[#FFB6A8]" /> Total Pengeluaran</span><strong className="text-sm">{currency(expenseTotal)}</strong></div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between"><span className="text-xs text-white/75">Selisih</span><strong className="text-lg">{currency(balance)}</strong></div>
        </div>
        <div className={`mt-5 rounded-2xl px-4 py-3 ${balance > 0 ? 'bg-[#DCFCE7] text-[#16A34A]' : balance < 0 ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-white/15 text-white'}`}>
          <p className="text-[10px] font-bold tracking-[0.14em]">{balance > 0 ? 'SURPLUS' : balance < 0 ? 'DEFISIT' : 'NETRAL'}</p>
          <p className="mt-1 text-[11px] opacity-80">{income ? `${usage}% dari pemasukan digunakan` : 'Belum ada pemasukan untuk menghitung pemakaian'}</p>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Rincian</p><h2 className="mt-1 text-lg font-bold">Per Kategori</h2></div><span className="text-[11px] text-[#858A85]">{expenses.length} transaksi</span></div>
        {categoryRows.length ? <div className="card divide-y divide-[#F1F1EF] px-4">{categoryRows.map((row, index) => {
          const percentage = expenseTotal ? Math.round((row.amount / expenseTotal) * 100) : 0;
          return <div key={row.category} className="py-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{row.category}</p><p className="mt-1 text-[10px] text-[#8A8F8A]">{row.count}x transaksi</p></div><div className="text-right"><p className="text-sm font-bold">{currency(row.amount)}</p><p className="mt-1 text-[10px] text-[#858A85]">{percentage}%</p></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F1EE]"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: ['#688B70', '#D6A75D', '#7293A3', '#C77C70', '#9B8AB3'][index % 5] }} /></div></div>;
        })}</div> : <EmptyState title="Belum ada pengeluaran" description="Rincian kategori akan muncul setelah transaksi dicatat." />}
      </section>
      <section>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Kelola Data</p>
        <div className="card divide-y divide-[#F1F1EF] px-4">
          <button onClick={exportCsv} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EDF2EC] text-[#486253]"><Download size={18} /></span><span className="flex-1"><strong className="block text-xs">Ekspor Data ke CSV</strong><small className="mt-1 block text-[10px] text-[#8A8F8A]">Unduh seluruh catatan transaksi</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>
          <button onClick={resetMonth} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF6E8] text-[#B98335]"><RotateCcw size={17} /></span><span className="flex-1"><strong className="block text-xs">Reset Data Bulan Ini</strong><small className="mt-1 block text-[10px] text-[#8A8F8A]">Hapus transaksi pada periode terpilih</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>
          <button onClick={resetAll} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FDECEC] text-[#C45151]"><ShieldAlert size={18} /></span><span className="flex-1"><strong className="block text-xs text-[#C45151]">Reset Semua Data</strong><small className="mt-1 block text-[10px] text-[#8A8F8A]">Hapus seluruh catatan transaksi</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>
        </div>
      </section>
      </div>
    </main>
  );
}
