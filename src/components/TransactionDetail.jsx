import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Pencil, Tag, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteTransaction, getTransactionById, updateTransaction } from '../services/api.js';
import { currency, formatDate } from '../utils/format.js';
import { getErrorMessage } from '../utils/errors.js';
import useAuth from '../hooks/useAuth.js';
import { subscribeTransactions } from '../services/transactionEvents.js';
import EmptyState from './EmptyState.jsx';
import PageHeading from './PageHeading.jsx';
import TransactionForm from './TransactionForm.jsx';

export default function TransactionDetail({ type }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transaction, setTransaction] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let eventVersion = 0;
    const unsubscribe = subscribeTransactions(({ userId: eventUserId, transactions }) => {
      if (!active || String(eventUserId) !== String(user?.id)) return;
      eventVersion += 1;
      const current = transactions.find((item) => item.id === String(id));
      setTransaction(current?.type === type ? current : null);
      setLoading(false);
    });
    getTransactionById(id)
      .then((item) => {
        if (active && eventVersion === 0) setTransaction(item?.type === type ? item : null);
      })
      .catch((cause) => { if (active) setError(getErrorMessage(cause, 'Transaksi gagal dimuat.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, [id, type, user?.id]);

  const save = async (changes) => {
    const updated = await updateTransaction(id, changes);
    setTransaction(updated);
    setEditing(false);
    setError('');
  };
  const remove = async () => {
    if (!window.confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await deleteTransaction(id);
      navigate(type === 'income' ? '/pemasukan' : '/', { replace: true });
    } catch (cause) {
      setError(getErrorMessage(cause, 'Transaksi gagal dihapus.'));
    }
  };

  if (loading) return <main className="page-pad"><p className="py-16 text-center text-sm text-[#858A85]">Memuat transaksi...</p></main>;
  if (!transaction) return <main className="page-pad"><PageHeading title="Detail transaksi" back /><EmptyState title="Transaksi tidak ditemukan" description={error || 'Data mungkin sudah dihapus.'} /></main>;
  const income = type === 'income';
  const Icon = income ? ArrowDownLeft : ArrowUpRight;

  return (
    <main className="page-pad">
      <PageHeading title="Detail transaksi" subtitle={income ? 'Pemasukan' : 'Pengeluaran'} back />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      {editing ? (
        <section className="card p-5"><h2 className="mb-5 text-base font-bold">Edit transaksi</h2><TransactionForm initial={transaction} onSubmit={save} submitLabel="Simpan perubahan" compact /></section>
      ) : (
        <>
          <section className="rounded-[28px] bg-[#24332C] p-6 text-white shadow-xl shadow-[#24332C]/10">
            <div className={`mb-7 grid h-12 w-12 place-items-center rounded-2xl ${income ? 'bg-[#DDF2D0] text-[#24332C]' : 'bg-white/10 text-white'}`}><Icon size={23} /></div>
            <p className="text-xs text-white/65">{income ? 'Jumlah pemasukan' : 'Jumlah pengeluaran'}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{income ? '+' : '-'}{currency(transaction.amount)}</p>
          </section>
          <section className="card mt-4 divide-y divide-[#F1F1EF] px-5">
            <div className="py-4"><p className="text-[11px] text-[#8A8F8A]">Judul</p><p className="mt-1 text-sm font-semibold">{transaction.title}</p></div>
            <div className="flex items-center gap-3 py-4"><Tag size={17} className="text-[#8A8F8A]" /><div><p className="text-[11px] text-[#8A8F8A]">Kategori / sumber</p><p className="mt-1 text-sm font-semibold">{transaction.category}</p></div></div>
            <div className="flex items-center gap-3 py-4"><CalendarDays size={17} className="text-[#8A8F8A]" /><div><p className="text-[11px] text-[#8A8F8A]">Tanggal</p><p className="mt-1 text-sm font-semibold">{formatDate(transaction.date)}</p></div></div>
            <div className="py-4"><p className="text-[11px] text-[#8A8F8A]">Catatan</p><p className="mt-1 whitespace-pre-wrap text-sm font-medium">{transaction.note || 'Tidak ada catatan'}</p></div>
          </section>
          <div className="mt-5 flex flex-col gap-3">
            <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-[#24332C] py-3.5 text-sm font-semibold text-white"><Pencil size={16} /> Edit</button>
            <button onClick={remove} className="flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white py-3.5 text-sm font-semibold text-red-600"><Trash2 size={16} /> Hapus</button>
          </div>
        </>
      )}
    </main>
  );
}
