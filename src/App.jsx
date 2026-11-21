import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import FloatingActionButton from './components/FloatingActionButton.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import useAuth from './hooks/useAuth.js';
import DetailPengeluaran from './pages/DetailPengeluaran.jsx';
import DetailPemasukan from './pages/DetailPemasukan.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Pemasukan from './pages/Pemasukan.jsx';
import Pengeluaran from './pages/Pengeluaran.jsx';
import Profil from './pages/Profil.jsx';
import Register from './pages/Register.jsx';
import Rekap from './pages/Rekap.jsx';
import TambahTransaksi from './pages/TambahTransaksi.jsx';

function SessionLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#FAFAFA] text-sm text-[#6B7280]">Memeriksa sesi...</main>;
}

function PublicOnly({ children }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <SessionLoading />;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function ProtectedLayout() {
  const { loading, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const isDetail = pathname.startsWith('/pengeluaran/') || pathname.startsWith('/pemasukan/');
  const showAddButton = ['/', '/pemasukan', '/pengeluaran'].includes(pathname);

  if (loading) return <SessionLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md bg-[#F7F7F5] px-4 pb-28 md:max-w-2xl md:px-6">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pemasukan" element={<Pemasukan />} />
        <Route path="/pengeluaran" element={<Pengeluaran />} />
        <Route path="/tambah" element={<TambahTransaksi />} />
        <Route path="/rekap" element={<Rekap />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/pengeluaran/:id" element={<DetailPengeluaran />} />
        <Route path="/pemasukan/:id" element={<DetailPemasukan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAddButton && <FloatingActionButton />}
      {!isDetail && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
