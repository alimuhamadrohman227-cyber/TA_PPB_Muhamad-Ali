import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../services/api.js';

export default function AuthForm({ mode }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('Butuh koneksi internet untuk masuk');
      return;
    }
    setProcessing(true);
    try {
      if (isRegister) {
        await register({ name, email, password });
      } else {
        await login({ email, password });
      }
      navigate('/', { replace: true });
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 py-8 [padding-top:max(2rem,env(safe-area-inset-top))] [padding-bottom:max(2rem,env(safe-area-inset-bottom))]">
      <section className="w-full max-w-[420px] rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(31,41,55,0.07)] sm:p-8">
        <h1 className="text-center text-[28px] font-bold tracking-tight text-[#1F2937]">
          {isRegister ? 'Buat Akun Baru' : 'Catatan Keuangan'}
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-[#6B7280]">
          {isRegister ? 'Daftar untuk mulai pencatatan mandiri' : 'Masuk untuk mengelola transaksi keluarga'}
        </p>

        {error && <p role="alert" className="mt-6 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}

        <form onSubmit={submit} className="mt-7 space-y-4">
          {isRegister && (
            <label className="block">
              <span className="sr-only">Nama Lengkap</span>
              <input
                autoComplete="name"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nama Lengkap"
                className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 text-base text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#465A4F] focus:ring-4 focus:ring-[#465A4F]/10"
              />
            </label>
          )}
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 text-base text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#465A4F] focus:ring-4 focus:ring-[#465A4F]/10"
            />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <span className="relative block">
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 6 : undefined}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-14 w-full rounded-2xl border border-[#E5E7EB] bg-[#F8F9FB] px-4 pr-12 text-base text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#465A4F] focus:ring-4 focus:ring-[#465A4F]/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={processing}
            className="h-14 w-full rounded-2xl bg-[#465A4F] text-base font-bold text-white transition hover:bg-[#394B41] active:bg-[#314238] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#6B7280]">
          {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
          <Link className="font-bold text-[#465A4F] hover:underline" to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Masuk' : 'Daftar'}
          </Link>
        </p>
      </section>
    </main>
  );
}
