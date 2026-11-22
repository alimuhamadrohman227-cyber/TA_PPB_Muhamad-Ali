import { NotebookPen } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EmptyState({
  title = 'Belum ada catatan',
  description = 'Catat transaksi pertamamu untuk mulai melihat ringkasan keuangan.',
  actionLabel = 'Tambah transaksi',
  actionType,
}) {
  const addUrl = actionType ? `/tambah?type=${actionType}` : '/tambah';
  const addState = actionType ? { type: actionType } : undefined;
  return (
    <div className="rounded-3xl border border-dashed border-[#DADDD8] bg-white/70 px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#EDF2EC] text-[#51675B]"><NotebookPen size={24} /></div>
      <h3 className="text-sm font-bold text-[#303A34]">{title}</h3>
      <p className="caption mx-auto mt-2 max-w-[230px]">{description}</p>
      <Link to={addUrl} state={addState} className="mt-5 inline-flex rounded-full bg-[#24332C] px-5 py-2.5 text-xs font-semibold text-white">{actionLabel}</Link>
    </div>
  );
}
