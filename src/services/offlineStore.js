const DATABASE_PREFIX = 'catatan-keuangan:offline:';
const DATABASE_VERSION = 2;
const TRANSACTIONS_STORE = 'transactions';
const OUTBOX_STORE = 'outbox';
const databasePromises = new Map();

function assertUserId(userId) {
  const value = String(userId ?? '').trim();
  if (!value) throw new Error('Data pengguna tidak tersedia untuk penyimpanan offline.');
  return value;
}

function createId() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Perangkat ini tidak mendukung pembuatan ID transaksi offline.');
  }
  return globalThis.crypto.randomUUID();
}

function databaseName(userId) {
  return `${DATABASE_PREFIX}${encodeURIComponent(assertUserId(userId))}`;
}

function openDatabase(userId) {
  const key = databaseName(userId);
  if (databasePromises.has(key)) return databasePromises.get(key);
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Penyimpanan offline tidak tersedia di perangkat ini.'));
  }

  const databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(key, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        database.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'queueId' });
        outbox.createIndex('transactionId', 'transactionId', { unique: false });
        outbox.createIndex('createdAt', 'createdAt', { unique: false });
      } else {
        const outbox = request.transaction.objectStore(OUTBOX_STORE);
        if (!outbox.indexNames.contains('transactionId')) {
          outbox.createIndex('transactionId', 'transactionId', { unique: false });
        }
        if (!outbox.indexNames.contains('createdAt')) {
          outbox.createIndex('createdAt', 'createdAt', { unique: false });
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromises.delete(key);
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('Basis data offline gagal dibuka.'));
    request.onblocked = () => reject(new Error('Basis data offline sedang digunakan di tab lain.'));
  });

  databasePromises.set(key, databasePromise);
  databasePromise.catch(() => databasePromises.delete(key));
  return databasePromise;
}

function transactionResult(database, stores, mode, action) {
  return new Promise((resolve, reject) => {
    let result;
    let actionError;
    const transaction = database.transaction(stores, mode);
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(actionError || transaction.error || new Error('Penyimpanan offline gagal.'));
    transaction.onerror = () => reject(transaction.error || new Error('Penyimpanan offline gagal.'));
    try {
      action(transaction, (value) => { result = value; });
    } catch (error) {
      actionError = error;
      transaction.abort();
    }
  });
}

function queueRecord(op, transactionId, payload, previous = null, createdAt = Date.now()) {
  const now = Date.now();
  return {
    queueId: previous?.queueId ?? createId(),
    op,
    transactionId,
    payload,
    createdAt: previous?.createdAt ?? createdAt,
    updatedAt: now,
    retryCount: 0,
    nextRetryAt: 0,
    status: 'pending',
    errorMessage: '',
    lastErrorStatus: null,
    processing: previous?.processing ?? false,
    revision: (previous?.revision ?? 0) + 1,
  };
}

function sortOutbox(items) {
  return items.sort((a, b) => a.createdAt - b.createdAt || a.queueId.localeCompare(b.queueId));
}

function overlayOutbox(serverTransactions, outbox) {
  const transactions = new Map(serverTransactions.map((transaction) => [transaction.id, transaction]));
  sortOutbox(outbox).forEach((item) => {
    if (item.op === 'delete') transactions.delete(item.transactionId);
    else if (item.payload) transactions.set(item.transactionId, { ...item.payload, _syncPending: true });
  });
  return [...transactions.values()];
}

export async function getLocalTransactions(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, TRANSACTIONS_STORE, 'readonly', (transaction, setResult) => {
    const request = transaction.objectStore(TRANSACTIONS_STORE).getAll();
    request.onsuccess = () => setResult(request.result);
  });
}

export async function getLocalTransaction(userId, transactionId) {
  const database = await openDatabase(userId);
  return transactionResult(database, TRANSACTIONS_STORE, 'readonly', (transaction, setResult) => {
    const request = transaction.objectStore(TRANSACTIONS_STORE).get(transactionId);
    request.onsuccess = () => setResult(request.result ?? null);
  });
}

export async function getOutbox(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readonly', (transaction, setResult) => {
    const request = transaction.objectStore(OUTBOX_STORE).getAll();
    request.onsuccess = () => setResult(sortOutbox(request.result));
  });
}

export async function queueLocalChange(userId, op, transactionId, payload) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction, setResult) => {
    const transactions = transaction.objectStore(TRANSACTIONS_STORE);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const queueRequest = outbox.index('transactionId').getAll(transactionId);
    queueRequest.onsuccess = () => {
      const [previous] = sortOutbox(queueRequest.result);
      const allQueueRequest = outbox.getAll();
      allQueueRequest.onsuccess = () => {
        const latestCreatedAt = allQueueRequest.result.reduce((latest, item) => Math.max(latest, item.createdAt), 0);
        const createdAt = Math.max(Date.now(), latestCreatedAt + 1);
        if (op === 'delete') {
          transactions.delete(transactionId);
          if (previous?.op === 'create' && !previous.processing) {
            outbox.delete(previous.queueId);
            setResult(null);
            return;
          }
          if (previous) {
            const next = queueRecord('delete', transactionId, payload ?? previous.payload, previous, createdAt);
            outbox.put(next);
            setResult(next);
            return;
          }
          const next = queueRecord('delete', transactionId, payload, null, createdAt);
          outbox.put(next);
          setResult(next);
          return;
        }

        transactions.put({ ...payload, _syncPending: true });
        const isUnconfirmed = payload?.serverConfirmed === false;
        const nextOp = (op === 'create'
          || previous?.op === 'create'
          || isUnconfirmed)
          ? 'create'
          : 'update';
        const next = queueRecord(nextOp, transactionId, payload, previous, createdAt);
        outbox.put(next);
        setResult(next);
      };
    };
  });
}

export async function markOutboxProcessing(userId, queueId) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readwrite', (transaction, setResult) => {
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.get(queueId);
    request.onsuccess = () => {
      const item = request.result;
      if (!item || item.processing || item.status === 'failed') {
        setResult(null);
        return;
      }
      const next = { ...item, processing: true };
      store.put(next);
      setResult(next);
    };
  });
}

export async function completeOutboxItem(userId, sentItem, serverTransaction = null) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction, setResult) => {
    const transactions = transaction.objectStore(TRANSACTIONS_STORE);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const request = outbox.get(sentItem.queueId);
    request.onsuccess = () => {
      const current = request.result;
      if (!current) {
        setResult(false);
        return;
      }
      if (current.revision !== sentItem.revision) {
        outbox.put({ ...current, processing: false });
        setResult(false);
        return;
      }

      outbox.delete(sentItem.queueId);
      if (sentItem.op === 'delete') transactions.delete(sentItem.transactionId);
      else if (serverTransaction) transactions.put(serverTransaction);
      setResult(true);
    };
  });
}

export async function failOutboxItem(userId, sentItem, { permanent, message, retryAt, errorStatus }) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readwrite', (transaction, setResult) => {
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.get(sentItem.queueId);
    request.onsuccess = () => {
      const current = request.result;
      if (!current) {
        setResult(null);
        return;
      }
      const sameRevision = current.revision === sentItem.revision;
      const retryCount = sameRevision ? current.retryCount + 1 : current.retryCount;
      const next = {
        ...current,
        processing: false,
        status: sameRevision && permanent ? 'failed' : 'pending',
        retryCount,
        nextRetryAt: sameRevision ? retryAt : 0,
        errorMessage: sameRevision && permanent ? message : '',
        lastErrorStatus: sameRevision ? errorStatus ?? null : null,
      };
      store.put(next);
      setResult(next);
    };
  });
}

export async function retryFailedOutbox(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readwrite', (transaction, setResult) => {
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      request.result.forEach((item) => {
        if (item.status === 'failed') {
          store.put({
            ...item,
            status: 'pending',
            errorMessage: '',
            lastErrorStatus: null,
            nextRetryAt: 0,
            retryCount: 0,
            processing: false,
            revision: item.revision + 1,
          });
        }
      });
      setResult(request.result.filter((item) => item.status === 'failed').length);
    };
  });
}

export async function recoverMissingUpdateItems(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readwrite', (transaction, setResult) => {
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const candidates = request.result.filter((item) => item.status === 'failed'
        && item.op === 'update'
        && (item.lastErrorStatus === 404
          || item.errorMessage === 'Transaksi tidak ditemukan.'
          || item.errorMessage === 'Transaction not found.'));
      candidates.forEach((item) => {
        store.put({
          ...item,
          status: 'pending',
          errorMessage: '',
          lastErrorStatus: null,
          retryCount: 0,
          nextRetryAt: 0,
          processing: false,
          revision: item.revision + 1,
        });
      });
      setResult(candidates.length);
    };
  });
}

export async function discardFailedOutboxAndMergeServer(userId, serverTransactions) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction, setResult) => {
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const request = outbox.getAll();
    request.onsuccess = () => {
      const failedItems = request.result.filter((item) => item.status === 'failed');
      failedItems.forEach((item) => outbox.delete(item.queueId));
      const remaining = request.result.filter((item) => item.status !== 'failed');
      const merged = overlayOutbox(serverTransactions, remaining);
      const transactions = transaction.objectStore(TRANSACTIONS_STORE);
      transactions.clear();
      merged.forEach((item) => transactions.put(item));
      setResult({ count: failedItems.length, transactions: merged });
    };
  });
}

export async function recoverOutboxProcessing(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, OUTBOX_STORE, 'readwrite', (transaction) => {
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      request.result.forEach((item) => {
        if (item.processing) store.put({ ...item, processing: false });
      });
    };
  });
}

export async function mergeServerTransactions(userId, serverTransactions, shouldApply = () => true) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction, setResult) => {
    const outboxRequest = transaction.objectStore(OUTBOX_STORE).getAll();
    outboxRequest.onsuccess = () => {
      if (!shouldApply()) {
        const request = transaction.objectStore(TRANSACTIONS_STORE).getAll();
        request.onsuccess = () => setResult(request.result);
        return;
      }
      const merged = overlayOutbox(serverTransactions, outboxRequest.result);
      const store = transaction.objectStore(TRANSACTIONS_STORE);
      store.clear();
      merged.forEach((item) => store.put(item));
      setResult(merged);
    };
  });
}

export async function discardLocalPeriodChanges(userId, year, month) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction, setResult) => {
    const transactions = transaction.objectStore(TRANSACTIONS_STORE);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const transactionRequest = transactions.getAll();
    transactionRequest.onsuccess = () => {
      const matchingIds = new Set(transactionRequest.result
        .filter((item) => String(item.date).slice(0, 4) === String(year)
          && (month === undefined || Number(String(item.date).slice(5, 7)) === month))
        .map((item) => item.id));
      matchingIds.forEach((id) => transactions.delete(id));
      const outboxRequest = outbox.getAll();
      outboxRequest.onsuccess = () => {
        outboxRequest.result.forEach((item) => {
          if (matchingIds.has(item.transactionId)
            || (item.payload && String(item.payload.date).slice(0, 4) === String(year)
              && (month === undefined || Number(String(item.payload.date).slice(5, 7)) === month))) {
            outbox.delete(item.queueId);
          }
        });
        setResult(matchingIds.size);
      };
    };
  });
}

export async function clearUserTransactions(userId) {
  const database = await openDatabase(userId);
  return transactionResult(database, [TRANSACTIONS_STORE, OUTBOX_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(TRANSACTIONS_STORE).clear();
    transaction.objectStore(OUTBOX_STORE).clear();
  });
}

export async function deleteUserDatabase(userId) {
  const key = databaseName(userId);
  const pendingOpen = databasePromises.get(key);
  if (pendingOpen) {
    const database = await pendingOpen;
    database.close();
    databasePromises.delete(key);
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Data offline gagal dihapus.'));
    request.onblocked = () => reject(new Error('Data offline masih digunakan di tab lain. Tutup tab lain lalu coba lagi.'));
  });
}
