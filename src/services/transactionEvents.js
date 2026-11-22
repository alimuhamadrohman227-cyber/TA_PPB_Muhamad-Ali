const EVENT_NAME = 'catatan-keuangan:transactions-updated';

export function publishTransactionsUpdate(userId, transactions) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { userId: String(userId), transactions },
  }));
}

export function subscribeTransactions(callback) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => callback(event.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
