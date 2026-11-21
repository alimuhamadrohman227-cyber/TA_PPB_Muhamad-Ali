import { Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function FloatingActionButton() {
  const { pathname } = useLocation();
  const type = pathname === '/pemasukan' ? 'income' : 'expense';

  return (
    <Link
      to={`/tambah?type=${type}`}
      state={{ type }}
      aria-label="Tambah transaksi"
      className="fixed bottom-24 right-[max(1rem,calc((100vw-28rem)/2+1rem))] z-40 grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-[#24332C]/90 text-white shadow-[0_8px_24px_rgba(36,51,44,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-xl transition hover:bg-[#30463A]/95 active:scale-95 md:right-[max(1.5rem,calc((100vw-42rem)/2+1.5rem))]"
    >
      <Plus size={25} strokeWidth={2.2} />
    </Link>
  );
}
