import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import LiquidSegmentedControl from './LiquidSegmentedControl.jsx';
import { localDateString } from '../utils/format.js';
import { getApiErrorMessage } from '../services/api.js';

const expenseCategories = ['Makan', 'Belanja', 'Tagihan', 'Transportasi', 'Lainnya'];
const incomeCategories = ['Uang Saku', 'Gaji/Freelance', 'Sisa Bulan Lalu', 'Lainnya'];
const transactionTypes = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
];

export default function TransactionForm({ initial = {}, onSubmit, submitLabel = 'Simpan transaksi', compact = false }) {
  const [type, setType] = useState(initial.type ?? 'expense');
  const [title, setTitle] = useState(initial.title ?? '');
  const [amount, setAmount] = useState(initial.amount ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [date, setDate] = useState(initial.date?.slice(0, 10) ?? localDateString());
  const [note, setNote] = useState(initial.note ?? '');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const categories = type === 'expense' ? expenseCategories : incomeCategories;
  const handleType = (nextType) => {
    setType(nextType);
    setCategory('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setProcessing(true);
    try {
      await onSubmit({ type, title, amount: Number(amount), category, date, note: String(note ?? '').trim() });
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      {!compact && (
        <LiquidSegmentedControl
          options={transactionTypes}
          value={type}
          onChange={handleType}
          variant="light"
          className="w-full"
        />
      )}
      <label className="block">
        <span className="label">Nominal (Rupiah)</span>
        <div className="flex items-center rounded-2xl border border-[#E8E9E6] bg-white px-4 focus-within:border-[#24332C] focus-within:ring-2 focus-within:ring-[#24332C]/10">
          <span className="mr-2 text-sm font-bold text-[#7C837D]">Rp</span>
          <input required min="1" step="1" type="number" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="w-full border-0 bg-transparent py-3.5 text-sm font-semibold outline-none" />
        </div>
      </label>
      <label className="block"><span className="label">Judul transaksi</span><input required maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Contoh: Makan siang" className="field" /></label>
      <label className="block"><span className="label">Kategori</span><select required value={category} onChange={(event) => setCategory(event.target.value)} className="field"><option value="" disabled>Pilih kategori</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="block"><span className="label">Tanggal</span><span className="relative block"><CalendarDays size={17} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#858A85]" /><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field pr-11" /></span></label>
      <label className="block"><span className="label">Catatan <span className="font-normal normal-case">(opsional)</span></span><textarea rows="3" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Tambahkan detail jika diperlukan..." className="field resize-none" /></label>
      <button type="submit" disabled={processing} className="w-full rounded-2xl bg-[#24332C] py-4 text-sm font-semibold text-white shadow-lg shadow-[#24332C]/10 disabled:cursor-not-allowed disabled:opacity-60">{processing ? 'Memproses...' : submitLabel}</button>
    </form>
  );
}
