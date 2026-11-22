import { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { changePassword, getApiErrorMessage } from '../services/api.js';

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative block">
        <input
          required
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="field pr-12"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-1 grid w-10 place-items-center text-[#858A85]"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function ChangePasswordSheet({ onClose, onSuccess }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visibility, setVisibility] = useState([false, false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const toggleVisibility = (index) => {
    setVisibility((current) => current.map((isVisible, itemIndex) => (
      itemIndex === index ? !isVisible : isVisible
    )));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Konfirmasi kata sandi baru tidak sama.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await changePassword({ oldPassword, newPassword });
      onSuccess();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Kata sandi gagal diperbarui.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 sm:items-center sm:px-4 motion-safe:animate-[dialog-fade-in_160ms_ease-out] motion-reduce:animate-none"
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.16)] sm:rounded-3xl sm:pb-5 motion-safe:animate-[dialog-sheet-in_200ms_ease-out] motion-reduce:animate-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="change-password-title" className="text-base font-bold text-[#303A34]">Ganti Kata Sandi</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup"
            className="grid h-9 w-9 place-items-center rounded-full text-[#858A85] disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-2xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            label="Kata sandi lama"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            visible={visibility[0]}
            onToggle={() => toggleVisibility(0)}
            autoComplete="current-password"
          />
          <PasswordField
            label="Kata sandi baru"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            visible={visibility[1]}
            onToggle={() => toggleVisibility(1)}
            autoComplete="new-password"
          />
          <p className="-mt-2 text-[10px] text-[#858A85]">Minimal 6 karakter.</p>
          <PasswordField
            label="Konfirmasi kata sandi baru"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            visible={visibility[2]}
            onToggle={() => toggleVisibility(2)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 min-h-12 w-full rounded-2xl bg-[#24332C] px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Memproses...' : 'Simpan Kata Sandi'}
          </button>
        </form>
      </section>
    </div>
  );
}
