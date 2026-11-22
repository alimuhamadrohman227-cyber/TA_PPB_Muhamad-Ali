import { ArrowDownLeft, ArrowUpRight, Home, PieChart, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import LiquidNavControl from './LiquidNavControl.jsx';

const links = [
  { value: '/', label: 'Beranda', icon: Home },
  { value: '/pemasukan', label: 'Pemasukan', icon: ArrowDownLeft },
  { value: '/pengeluaran', label: 'Pengeluaran', icon: ArrowUpRight },
  { value: '/rekap', label: 'Rekap', icon: PieChart },
  { value: '/profil', label: 'Profil', icon: UserRound },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const value = links.some((link) => link.value === pathname) ? pathname : undefined;

  return (
    <nav aria-label="Navigasi utama" className="nav-position fixed left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2">
      <LiquidNavControl
        options={links}
        value={value}
        onChange={navigate}
      />
    </nav>
  );
}
