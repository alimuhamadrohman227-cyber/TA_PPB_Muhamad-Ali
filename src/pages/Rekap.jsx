import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Download, RotateCcw, ShieldAlert, X } from 'lucide-react';
import AnimatedCurrency from '../components/AnimatedCurrency.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LiquidSegmentedControl from '../components/LiquidSegmentedControl.jsx';
import { ListSkeleton, SummarySkeleton } from '../components/LoadingSkeleton.jsx';
import PageHeading from '../components/PageHeading.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import { getTransactions, resetAllTransactions, resetMonthTransactions } from '../services/api.js';
import { currency } from '../utils/format.js';
import { formatMonthLabel, parseYMD } from '../utils/helpers.js';
import { getErrorMessage } from '../utils/errors.js';

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const periods = [
  { value: 'Bulanan', label: 'Bulanan' },
  { value: 'Tahunan', label: 'Tahunan' },
  { value: 'Semua', label: 'Semua' },
];

function ConfirmationDialog({
  mode,
  periodName,
  count,
  typedConfirmation,
  onTypeConfirmation,
  onClose,
  onConfirm,
  isDeleting,
  error,
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleting, onClose]);

  const isPeriod = mode === 'period';
  const canDelete = isPeriod
    ? count > 0
    : typedConfirmation.trim().toUpperCase() === 'HAPUS';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 sm:items-center sm:px-4 motion-safe:animate-[dialog-fade-in_160ms_ease-out] motion-reduce:animate-none"
      onClick={() => { if (!isDeleting) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.16)] sm:rounded-3xl sm:pb-5 motion-safe:animate-[dialog-sheet-in_200ms_ease-out] motion-reduce:animate-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="reset-dialog-title" className="text-base font-bold text-[#303A34]">
            {isPeriod ? 'Reset Data Periode' : 'Reset Semua Data'}
          </h2>
          <button type="button" onClick={onClose} disabled={isDeleting} aria-label="Tutup dialog" className="grid h-9 w-9 place-items-center rounded-full text-[#6B7280] disabled:opacity-50">
            <X size={19} />
          </button>
        </div>
        {isPeriod ? (
          <>
            <p className="text-sm leading-6 text-[#59635C]">
              Hapus {count} transaksi pada {periodName}? Tindakan ini tidak bisa dibatalkan.
            </p>
            {count === 0 && <p className="caption mt-3">Tidak ada transaksi pada periode ini</p>}
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-[#59635C]">
              Hapus semua {count} transaksi? Tindakan ini tidak bisa dibatalkan.
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold text-[#59635C]">Ketik HAPUS untuk melanjutkan</span>
              <input
                autoFocus
                value={typedConfirmation}
                onChange={(event) => onTypeConfirmation(event.target.value)}
                disabled={isDeleting}
                className="w-full rounded-xl border border-[#E8E9E6] bg-white px-3 py-3 text-sm outline-none focus:border-[#24332C]"
                autoComplete="off"
              />
            </label>
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#B91C1C]">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="min-h-11 flex-1 rounded-xl border border-[#E8E9E6] bg-white px-4 text-sm font-semibold text-[#59635C] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}
            className="min-h-11 flex-1 rounded-xl bg-[#C45151] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isDeleting ? 'Menghapus...' : isPeriod ? 'Hapus' : 'Hapus Semua'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Rekap() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('Bulanan');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [success, setSuccess] = useState('');
  const reloadTransactions = useCallback(async () => {
    setTransactions(await getTransactions());
  }, []);

  useEffect(() => {
    reloadTransactions()
      .catch((cause) => setError(getErrorMessage(cause, 'Data transaksi gagal dimuat.')))
      .finally(() => setLoading(false));
  }, [reloadTransactions]);

  const filtered = useMemo(() => transactions.filter((item) => {
    if (period === 'Semua') return true;
    const date = parseYMD(item.date);
    if (!date) return false;
    return period === 'Tahunan'
      ? date.year === selectedMonth.getFullYear()
      : date.year === selectedMonth.getFullYear() && date.month === selectedMonth.getMonth() + 1;
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
  const dateParts = transactions.map((item) => parseYMD(item.date)).filter(Boolean);
  const dateYears = dateParts.map(({ year }) => year);
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const firstYear = dateYears.length ? Math.min(2000, ...dateYears) : 2000;
    const lastYear = Math.max(currentYear + 1, ...dateYears);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  }, [transactions, currentYear]);
  const yearsWithData = [...new Set(dateYears)].sort((a, b) => a - b);
  const monthsWithData = [...new Set(dateParts.map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`))];
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeDialog = useCallback(() => {
    if (isDeleting) return;
    setDialog(null);
    setDialogError('');
    setTypedConfirmation('');
  }, [isDeleting]);
  const changePeriod = (nextPeriod) => {
    setPickerOpen(false);
    setPeriod(nextPeriod);
  };
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
  const periodName = period === 'Tahunan'
    ? `Tahun ${selectedMonth.getFullYear()}`
    : formatMonthLabel(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1);
  const beginReset = (mode) => {
    setDialog(mode);
    setDialogError('');
    setTypedConfirmation('');
    setSuccess('');
  };
  const resetData = async () => {
    if (!dialog || isDeleting) return;
    setIsDeleting(true);
    setDialogError('');
    try {
      if (dialog === 'period') {
        await resetMonthTransactions(
          selectedMonth.getFullYear(),
          period === 'Bulanan' ? selectedMonth.getMonth() + 1 : undefined,
        );
      } else {
        await resetAllTransactions();
      }
      setDialog(null);
      setTypedConfirmation('');
      setSuccess('Data berhasil dihapus');
      setError('');
      try {
        await reloadTransactions();
      } catch (cause) {
        setError(getErrorMessage(cause, 'Data berhasil dihapus, tetapi daftar transaksi gagal dimuat.'));
      }
      window.setTimeout(() => setSuccess(''), 3500);
    } catch (cause) {
      setDialogError(getErrorMessage(cause, 'Data gagal dihapus.'));
    } finally {
      setIsDeleting(false);
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
      {success && <p role="status" className="mb-4 rounded-2xl bg-[#EDF2EC] px-4 py-3 text-sm text-[#486253]">{success}</p>}
      <LiquidSegmentedControl options={periods} value={period} onChange={changePeriod} className="mb-4 w-full" />
      {period !== 'Semua' && (
        <div className="relative mb-4 flex items-center justify-between rounded-2xl border border-[#EFEFED] bg-white px-3 py-2">
          <button onClick={() => shiftMonth(-1)} aria-label="Periode sebelumnya" className="grid h-10 w-10 place-items-center rounded-full text-[#59635C] transition active:scale-[0.97]"><ArrowLeft size={17} /></button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(true)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#38423B] transition active:scale-[0.97]"
          >
            {period === 'Tahunan' ? selectedMonth.getFullYear() : periodName}
            <ChevronDown size={14} className={`transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="Periode berikutnya" className="grid h-10 w-10 place-items-center rounded-full text-[#59635C] transition active:scale-[0.97]"><ArrowRight size={17} /></button>
        </div>
      )}
      {pickerOpen && period !== 'Semua' && (
        <PeriodPicker
          mode={period === 'Bulanan' ? 'month' : 'year'}
          value={selectedMonth}
          onChange={setSelectedMonth}
          availableYears={availableYears}
          yearsWithData={yearsWithData}
          monthsWithData={monthsWithData}
          onClose={closePicker}
        />
      )}
      <div className="flex flex-col space-y-section">
      {loading ? <SummarySkeleton /> : <section className="motion-enter rounded-[28px] bg-[#24332C] p-card text-white shadow-xl shadow-[#24332C]/10">
        <p className="caption text-white/80">Ringkasan {period === 'Semua' ? 'semua periode' : periodName}</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-body text-white/85"><ArrowDownLeft size={16} className="text-[#B9E6BC]" /> Total Pemasukan</span><strong className="money text-sm"><AnimatedCurrency amount={income} /></strong></div>
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-body text-white/85"><ArrowUpRight size={16} className="text-[#FFB6A8]" /> Total Pengeluaran</span><strong className="money text-sm"><AnimatedCurrency amount={expenseTotal} /></strong></div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between"><span className="text-body text-white/85">Selisih</span><strong className="money text-lg"><AnimatedCurrency amount={balance} /></strong></div>
        </div>
        <div className={`mt-5 rounded-2xl px-4 py-3 ${balance > 0 ? 'bg-[#DCFCE7] text-[#166534]' : balance < 0 ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-white/15 text-white'}`}>
          <p className="text-[10px] font-bold tracking-[0.14em]">{balance > 0 ? 'SURPLUS' : balance < 0 ? 'DEFISIT' : 'NETRAL'}</p>
          <p className="caption tabular-nums mt-1 text-[#39443D]">{income ? `${usage}% dari pemasukan digunakan` : 'Belum ada pemasukan untuk menghitung pemakaian'}</p>
        </div>
      </section>}
      <section>
        <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Rincian</p><h2 className="section-title mt-1.5">Per Kategori</h2></div><span className="caption tabular-nums">{expenses.length} transaksi</span></div>
        {loading ? <ListSkeleton /> : categoryRows.length ? <div className="card motion-enter divide-y divide-[#F1F1EF] px-card">{categoryRows.map((row, index) => {
          const percentage = expenseTotal ? Math.round((row.amount / expenseTotal) * 100) : 0;
          return <div key={row.category} className="motion-enter py-3.5" style={{ '--stagger-index': Math.min(index, 7) }}><div className="flex items-center justify-between"><div><p className="text-body font-semibold">{row.category}</p><p className="caption mt-1">{row.count}x transaksi</p></div><div className="text-right"><p className="money text-body font-bold">{currency(row.amount)}</p><p className="caption money mt-1">{percentage}%</p></div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F1EE]"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: ['#688B70', '#D6A75D', '#7293A3', '#C77C70', '#9B8AB3'][index % 5] }} /></div></div>;
        })}</div> : <EmptyState title="Belum ada pengeluaran" description="Rincian kategori akan muncul setelah transaksi dicatat." />}
      </section>
      <section>
        <p className="eyebrow mb-3">Kelola Data</p>
        <div className="card divide-y divide-[#F1F1EF] px-card">
          <button onClick={exportCsv} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EDF2EC] text-[#486253]"><Download size={18} /></span><span className="flex-1"><strong className="block text-xs">Ekspor Data ke CSV</strong><small className="caption mt-1 block">Unduh seluruh catatan transaksi</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>
          {period !== 'Semua' && <button onClick={() => beginReset('period')} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF6E8] text-[#B98335]"><RotateCcw size={17} /></span><span className="flex-1"><strong className="block text-xs">Reset Data Periode Ini</strong><small className="caption mt-1 block">Hapus transaksi pada {periodName}</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>}
          <button onClick={() => beginReset('all')} className="flex w-full items-center gap-3 py-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FDECEC] text-[#C45151]"><ShieldAlert size={18} /></span><span className="flex-1"><strong className="block text-xs text-[#C45151]">Reset Semua Data</strong><small className="caption mt-1 block">Hapus seluruh catatan transaksi</small></span><ArrowRight size={16} className="text-[#A0A5A0]" /></button>
        </div>
      </section>
      </div>
      {dialog && (
        <ConfirmationDialog
          mode={dialog}
          periodName={periodName}
          count={dialog === 'period' ? filtered.length : transactions.length}
          typedConfirmation={typedConfirmation}
          onTypeConfirmation={setTypedConfirmation}
          onClose={closeDialog}
          onConfirm={resetData}
          isDeleting={isDeleting}
          error={dialogError}
        />
      )}
    </main>
  );
}
