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
      className="fab-solid fixed right-[max(1rem,calc((100vw-28rem)/2+1rem))] z-40 grid h-14 w-14 place-items-center rounded-full text-white transition-transform duration-150 active:scale-[0.97] md:right-[max(1.5rem,calc((100vw-42rem)/2+1.5rem))]"
    >
      <Plus size={25} strokeWidth={2.2} />
    </Link>
  );
}
