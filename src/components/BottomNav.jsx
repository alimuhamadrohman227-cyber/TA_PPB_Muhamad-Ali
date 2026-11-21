import { ArrowDownLeft, ArrowUpRight, Home, PieChart, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import LiquidSegmentedControl from './LiquidSegmentedControl.jsx';

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
    <nav aria-label="Navigasi utama" className="fixed bottom-5 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2">
      <LiquidSegmentedControl
        options={links}
        value={value}
        onChange={navigate}
        variant="dark"
        className="w-full"
      />
    </nav>
  );
}
