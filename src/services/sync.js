import {
  completeOutboxItem,
  failOutboxItem,
  getOutbox,
  markOutboxProcessing,
  recoverMissingUpdateItems,
  recoverOutboxProcessing,
  retryFailedOutbox,
} from './offlineStore.js';

const listeners = new Set();
const retryTimers = new Map();
const statusTimers = new Map();
let activeSync = null;
let adapters = null;
const statusByUser = new Map();
const syncListenersByUser = new Map();
const RETRY_DELAYS_MS = [2000, 5000, 15000, 60000];

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function createStatus(userId) {
  return statusByUser.get(userId) || {
    userId,
    online: isOnline(),
    phase: isOnline() ? 'idle' : 'offline',
    pendingCount: 0,
    failedCount: 0,
    unsyncedTransactionIds: [],
    errorMessage: '',
  };
}

function notifyStatus(status) {
  statusByUser.set(status.userId, status);
  listeners.forEach((listener) => listener(status));
}

async function updateQueueStatus(userId, phase) {
  const queue = await getOutbox(userId);
  const previous = createStatus(userId);
  const online = isOnline();
  const status = {
    ...previous,
    online,
    phase: !online ? 'offline' : phase ?? (queue.length ? 'pending' : 'idle'),
    pendingCount: queue.length,
    failedCount: queue.filter((item) => item.status === 'failed').length,
    failureMessage: queue.find((item) => item.status === 'failed' && item.errorMessage)?.errorMessage ?? '',
    unsyncedTransactionIds: [...new Set(queue.map((item) => item.transactionId))],
    ...(phase === 'error' ? {} : { errorMessage: '' }),
  };
  notifyStatus(status);
  return status;
}

function scheduleRetry(userId, retryCount) {
  if (retryTimers.has(userId)) clearTimeout(retryTimers.get(userId));
  const delay = RETRY_DELAYS_MS[Math.min(retryCount - 1, RETRY_DELAYS_MS.length - 1)];
  const timer = setTimeout(() => {
    retryTimers.delete(userId);
    if (isOnline()) void syncPendingTransactions(userId);
  }, delay);
  retryTimers.set(userId, timer);
}

function isAuthorizationError(error) {
  return [401, 403].includes(error?.response?.status);
}

function isPermanentError(error) {
  const status = error?.response?.status;
  return Number.isInteger(status)
    && status >= 400
    && status < 500
    && ![401, 403, 408, 425, 429].includes(status);
}

async function runSync(userId, { retryFailed = false, force = false } = {}) {
  if (!isOnline()) {
    await updateQueueStatus(userId, 'offline');
    return;
  }
  if (!adapters) throw new Error('Modul sinkronisasi belum siap.');

  await recoverOutboxProcessing(userId);
  await recoverMissingUpdateItems(userId);
  if (retryFailed) await retryFailedOutbox(userId);
  let queue = await getOutbox(userId);
  if (queue.length) await updateQueueStatus(userId, 'syncing');

  let encounteredNetworkFailure = false;
  while (isOnline()) {
    queue = await getOutbox(userId);
    const item = queue.find((entry) => entry.status !== 'failed');
    if (!item) break;
    if (!force && item.nextRetryAt > Date.now()) {
      scheduleRetry(userId, item.retryCount);
      break;
    }

    if (adapters.getActiveUserId() !== userId) break;
    const processingItem = await markOutboxProcessing(userId, item.queueId);
    if (!processingItem) break;

    try {
      console.debug('[sync] mencoba', {
        op: processingItem.op,
        id: processingItem.transactionId,
        status: 'sending',
      });
      const result = await adapters.sendItem(processingItem, userId);
      await completeOutboxItem(userId, processingItem, result.transaction);
      console.debug('[sync] hasil', {
        op: processingItem.op,
        id: processingItem.transactionId,
        status: result.status,
      });
      await updateQueueStatus(userId, 'syncing');
      await adapters.publishTransactions(userId);
    } catch (error) {
      console.debug('[sync] gagal', {
        op: processingItem.op,
        id: processingItem.transactionId,
        status: error?.response?.status ?? error?.code ?? 'network-error',
      });
      if (isAuthorizationError(error)) {
        await failOutboxItem(userId, processingItem, {
          permanent: false,
          message: '',
          retryAt: Date.now(),
          errorStatus: error?.response?.status,
        });
        await updateQueueStatus(userId);
        break;
      }

      const retryCount = processingItem.retryCount + 1;
      const exhausted = retryCount > RETRY_DELAYS_MS.length;
      const permanent = isPermanentError(error) || exhausted;
      const retryAt = permanent ? 0 : Date.now() + RETRY_DELAYS_MS[retryCount - 1];
      await failOutboxItem(userId, processingItem, {
        permanent,
        message: adapters.getErrorMessage(error),
        retryAt,
        errorStatus: error?.response?.status,
      });
      await updateQueueStatus(userId);
      if (!permanent) {
        encounteredNetworkFailure = true;
        scheduleRetry(userId, retryCount);
        break;
      }
    }
  }

  await updateQueueStatus(userId);
  queue = await getOutbox(userId);
  const pending = queue.some((item) => item.status !== 'failed');
  if (pending || encounteredNetworkFailure || !isOnline()) return;

  try {
    if (adapters.getActiveUserId() === userId) {
      await adapters.refreshTransactions(userId);
    }
  } catch (error) {
    const status = await updateQueueStatus(userId);
    notifyStatus({
      ...status,
      phase: isOnline() ? 'error' : 'offline',
      errorMessage: isOnline() ? adapters.getErrorMessage(error) : '',
    });
    return;
  }

  await updateQueueStatus(userId);
  queue = await getOutbox(userId);
  if (queue.length === 0 && isOnline()) {
    await updateQueueStatus(userId, 'synced');
    if (statusTimers.has(userId)) clearTimeout(statusTimers.get(userId));
    const timer = setTimeout(() => {
      statusTimers.delete(userId);
      const current = createStatus(userId);
      if (current.phase === 'synced'
        && syncListenersByUser.has(userId)
        && adapters.getActiveUserId() === userId) {
        void updateQueueStatus(userId, 'idle');
      }
    }, 2500);
    statusTimers.set(userId, timer);
  }
}

export function configureSync(nextAdapters) {
  adapters = nextAdapters;
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(userId) {
  return createStatus(String(userId));
}

export async function refreshSyncStatus(userId) {
  return updateQueueStatus(String(userId));
}

export async function reportSyncError(userId, error) {
  const normalizedUserId = String(userId ?? '');
  const message = adapters?.getErrorMessage(error) || 'Sinkronisasi gagal.';
  try {
    const status = await updateQueueStatus(normalizedUserId);
    notifyStatus({
      ...status,
      phase: isOnline() ? 'error' : 'offline',
      errorMessage: isOnline() ? message : '',
    });
  } catch {
    notifyStatus({
      ...createStatus(normalizedUserId),
      phase: isOnline() ? 'error' : 'offline',
      errorMessage: isOnline() ? message : '',
    });
  }
}

export async function syncPendingTransactions(userId, options) {
  const normalizedUserId = String(userId ?? '');
  if (!normalizedUserId) return;
  if (activeSync) {
    const ongoing = activeSync;
    if (options?.retryFailed || options?.force) {
      return ongoing.then(() => syncPendingTransactions(normalizedUserId, options));
    }
    return ongoing;
  }
  const currentSync = runSync(normalizedUserId, options).catch(async (error) => {
    const message = adapters?.getErrorMessage(error) || 'Sinkronisasi gagal.';
    try {
      const status = await updateQueueStatus(normalizedUserId);
      notifyStatus({ ...status, phase: isOnline() ? 'error' : 'offline', errorMessage: message });
    } catch {
      notifyStatus({ ...createStatus(normalizedUserId), phase: 'error', errorMessage: message });
    }
  }).finally(() => {
    if (activeSync === currentSync) activeSync = null;
  });
  activeSync = currentSync;
  return currentSync;
}

export async function queueChanged(userId) {
  const normalizedUserId = String(userId);
  await updateQueueStatus(normalizedUserId);
  if (!isOnline()) return;
  if (!activeSync) {
    void syncPendingTransactions(normalizedUserId);
    return;
  }
  const ongoing = activeSync;
  void ongoing.then(async () => {
    const queue = await getOutbox(normalizedUserId);
    if (queue.some((item) => item.status === 'pending' && item.nextRetryAt <= Date.now())) {
      await syncPendingTransactions(normalizedUserId);
    }
  }).catch((error) => {
    const message = adapters?.getErrorMessage(error) || 'Sinkronisasi gagal.';
    void updateQueueStatus(normalizedUserId).then((status) => {
      notifyStatus({ ...status, phase: 'error', errorMessage: message });
    }).catch(() => {
      notifyStatus({ ...createStatus(normalizedUserId), phase: 'error', errorMessage: message });
    });
  });
}

export function startSyncListeners(userId) {
  const normalizedUserId = String(userId ?? '');
  if (!normalizedUserId) return () => {};
  const existing = syncListenersByUser.get(normalizedUserId);
  if (existing) return existing;

  const sync = () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      void syncPendingTransactions(normalizedUserId);
    }
  };
  const onOnline = () => { void syncPendingTransactions(normalizedUserId); };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', sync);
  void updateQueueStatus(normalizedUserId).catch((error) => {
    notifyStatus({
      ...createStatus(normalizedUserId),
      phase: isOnline() ? 'error' : 'offline',
      errorMessage: adapters?.getErrorMessage(error) || 'Status sinkronisasi gagal dimuat.',
    });
  });
  void syncPendingTransactions(normalizedUserId);

  const cleanup = () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', sync);
    syncListenersByUser.delete(normalizedUserId);
  };
  syncListenersByUser.set(normalizedUserId, cleanup);
  return cleanup;
}

export function stopSyncListeners(userId) {
  const normalizedUserId = String(userId ?? '');
  const cleanup = syncListenersByUser.get(normalizedUserId);
  if (cleanup) cleanup();
  const timer = retryTimers.get(normalizedUserId);
  if (timer) clearTimeout(timer);
  retryTimers.delete(normalizedUserId);
  const statusTimer = statusTimers.get(normalizedUserId);
  if (statusTimer) clearTimeout(statusTimer);
  statusTimers.delete(normalizedUserId);
}
