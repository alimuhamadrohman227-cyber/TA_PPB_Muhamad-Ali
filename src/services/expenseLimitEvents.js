const EVENT_NAME = 'catatan-keuangan:expense-limits-updated';

export function publishExpenseLimitsUpdate(userId, record) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { userId: String(userId), record },
  }));
}

export function subscribeExpenseLimits(callback) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => callback(event.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
