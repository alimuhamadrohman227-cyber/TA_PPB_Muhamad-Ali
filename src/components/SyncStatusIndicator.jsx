import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import useAuth from '../hooks/useAuth.js';
import {
  getSyncStatus,
  refreshSyncStatus,
  subscribeSyncStatus,
  syncPendingTransactions,
} from '../services/sync.js';
import { discardFailedChanges, getApiErrorMessage } from '../services/api.js';

function DiscardFailedDialog({ count, busy, error, onClose, onConfirm }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 sm:items-center sm:px-4"
      onClick={() => { if (!busy) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-failed-title"
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,0.16)] sm:rounded-3xl sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="discard-failed-title" className="text-base font-bold text-[#303A34]">Buang perubahan yang gagal?</h2>
        <p className="mt-3 text-sm leading-6 text-[#59635C]">
          {count} perubahan gagal akan dihapus dari antrean dan daftar akan dimuat ulang dari server. Tindakan ini tidak bisa dibatalkan.
        </p>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-[#FEF2F2] px-3 py-2.5 text-sm text-[#B91C1C]">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-[#E8E9E6] text-sm font-semibold text-[#59635C] disabled:opacity-50">Batal</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-[#C45151] text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memuat ulang...' : 'Buang perubahan'}</button>
        </div>
      </section>
    </div>
  );
}

export default function SyncStatusIndicator() {
  const { user } = useAuth();
  const [status, setStatus] = useState(() => getSyncStatus(user?.id ?? ''));
  const [actionError, setActionError] = useState('');
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState('');

  useEffect(() => {
    if (!user?.id) return undefined;
    setActionError('');
    setStatus(getSyncStatus(user.id));
    const unsubscribe = subscribeSyncStatus((next) => {
      if (String(next.userId) === String(user.id)) setStatus(next);
    });
    void refreshSyncStatus(user.id).catch((cause) => {
      setActionError(getApiErrorMessage(cause));
    });
    const updateOnlineState = () => {
      void refreshSyncStatus(user.id).catch((cause) => setActionError(getApiErrorMessage(cause)));
    };
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      unsubscribe();
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, [user?.id]);

  const synchronize = async () => {
    setActionError('');
    try {
      await syncPendingTransactions(user.id, { retryFailed: true, force: true });
    } catch (cause) {
      setActionError(getApiErrorMessage(cause));
    }
  };

  const discardChanges = async () => {
    setDiscardBusy(true);
    setDiscardError('');
    try {
      await discardFailedChanges();
      setDiscardDialogOpen(false);
    } catch (cause) {
      setDiscardError(getApiErrorMessage(cause));
    } finally {
      setDiscardBusy(false);
    }
  };

  if (!user?.id) return null;
  const currentStatus = String(status.userId) === String(user.id) ? status : getSyncStatus(user.id);
  const visible = currentStatus.phase !== 'idle';
  if (!visible && !actionError) return null;

  const message = actionError || currentStatus.errorMessage || (
    currentStatus.phase === 'offline' ? 'Offline'
      : currentStatus.phase === 'syncing' ? `Menyinkronkan ${currentStatus.pendingCount} perubahan…`
        : currentStatus.phase === 'synced' ? 'Tersinkron'
          : currentStatus.phase === 'error' ? 'Tidak dapat menghubungi server'
            : `${currentStatus.pendingCount} perubahan belum tersinkron`
  );
  const pending = currentStatus.pendingCount > 0;
  return (
    <>
      <div className={`mb-4 flex min-h-9 items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
        currentStatus.phase === 'offline' ? 'bg-[#F0F1EE] text-[#59635C]'
          : currentStatus.phase === 'syncing' ? 'bg-[#EDF2EC] text-[#486253]'
            : currentStatus.phase === 'error' || pending ? 'bg-[#FFF6E8] text-[#59635C]'
              : 'bg-[#EDF2EC] text-[#486253]'
      }`} role="status" aria-live="polite">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            {currentStatus.phase === 'offline' ? <CloudOff size={15} className="shrink-0" /> : <Cloud size={15} className="shrink-0" />}
            <span className="truncate">{message}</span>
          </span>
          {currentStatus.failureMessage && <span className="mt-1 break-words text-[11px]">{currentStatus.failureMessage}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {(pending || currentStatus.phase === 'error') && currentStatus.online && (
            <button type="button" onClick={synchronize} className="flex items-center gap-1 font-semibold underline underline-offset-2">
              <RefreshCw size={12} /> Sinkronkan sekarang
            </button>
          )}
          {currentStatus.failedCount > 0 && currentStatus.online && (
            <button
              type="button"
              onClick={() => { setDiscardError(''); setDiscardDialogOpen(true); }}
              className="text-right text-[11px] font-semibold underline underline-offset-2"
            >
              Buang perubahan yang gagal
            </button>
          )}
        </span>
      </div>
      {discardDialogOpen && (
        <DiscardFailedDialog
          count={currentStatus.failedCount}
          busy={discardBusy}
          error={discardError}
          onClose={() => { if (!discardBusy) setDiscardDialogOpen(false); }}
          onConfirm={discardChanges}
        />
      )}
    </>
  );
}
