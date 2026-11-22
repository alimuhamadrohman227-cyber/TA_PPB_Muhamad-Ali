import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, KeyRound, LogOut, Pencil, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChangePasswordSheet from '../components/ChangePasswordSheet.jsx';
import PageHeading from '../components/PageHeading.jsx';
import useAuth from '../hooks/useAuth.js';
import { getApiErrorMessage } from '../services/api.js';

export default function Profil() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(user?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const name = user?.name ?? '';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CK';
  const closePasswordSheet = useCallback(() => setPasswordSheetOpen(false), []);
  const passwordUpdated = useCallback(() => {
    setPasswordSheetOpen(false);
    setPasswordSuccess(true);
  }, []);

  useEffect(() => {
    if (!passwordSuccess) return undefined;
    const timeout = window.setTimeout(() => setPasswordSuccess(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [passwordSuccess]);

  const saveName = async (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      setError('Nama tidak boleh kosong.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile({ name: draft });
      setEditing(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Profil gagal diperbarui.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    if (!window.confirm('Yakin ingin keluar?')) return;
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="page-pad pb-6">
      <PageHeading title="Profil" />
      {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
      {passwordSuccess && <p role="status" className="mb-4 rounded-2xl bg-[#EDF2EC] px-4 py-3 text-sm text-[#486253]">Kata sandi berhasil diperbarui</p>}
      <section className="card flex items-center gap-4 p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[#25332C] text-lg font-bold text-[#D3E5C7]">{initials}</div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName}>
              <input autoFocus required maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} className="field py-2" aria-label="Nama lengkap" />
              <div className="mt-2 flex gap-3">
                <button disabled={saving} className="rounded-full bg-[#465A4F] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Memproses...' : 'Simpan'}</button>
                <button type="button" onClick={() => { setEditing(false); setDraft(name); setError(''); }} className="text-xs font-semibold text-[#6B7280]">Batal</button>
              </div>
            </form>
          ) : (
            <>
              <p className="truncate text-base font-bold">{name}</p>
              <p className="mt-1 truncate text-xs text-[#6B7280]">{user?.email}</p>
            </>
          )}
        </div>
        {!editing && (
          <button aria-label="Ubah nama" onClick={() => { setDraft(name); setEditing(true); }} className="grid h-9 w-9 place-items-center rounded-xl bg-[#F3F4F1] text-[#647168]">
            <Pencil size={16} />
          </button>
        )}
      </section>

      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Pengaturan Akun</p>
        <div className="card divide-y divide-[#F1F1EF] px-4">
          <button type="button" onClick={() => { setPasswordSuccess(false); setPasswordSheetOpen(true); }} className="flex w-full items-center gap-3.5 py-4 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F2F4F0] text-[#596A5F]"><KeyRound size={18} /></span>
            <span className="flex-1"><strong className="block text-sm font-semibold">Ganti Kata Sandi</strong><small className="mt-1 block text-[10px] text-[#858A85]">Perbarui kata sandi akunmu</small></span>
            <ChevronRight size={17} className="text-[#A0A5A0]" />
          </button>
        </div>
      </section>

      <section className="mt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#939892]">Tentang</p>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3.5 p-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#25332C] text-[#D3E5C7]"><UserRound size={20} /></span><div><p className="text-sm font-bold">Catatan Keuangan</p><p className="mt-1 text-[10px] text-[#858A85]">Versi 1.0.0 PWA</p></div></div>
          <p className="border-t border-[#F1F1EF] px-4 py-4 text-xs leading-5 text-[#777E78]">Aplikasi sederhana untuk membantu mencatat pemasukan, pengeluaran, dan memahami kebiasaan keuangan dengan lebih baik.</p>
        </div>
      </section>

      <button type="button" onClick={confirmLogout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] py-4 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2]">
        <LogOut size={17} /> Keluar
      </button>
      {passwordSheetOpen && (
        <ChangePasswordSheet onClose={closePasswordSheet} onSuccess={passwordUpdated} />
      )}
    </main>
  );
}
