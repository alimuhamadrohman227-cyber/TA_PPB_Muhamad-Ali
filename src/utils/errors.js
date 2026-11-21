export function getErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const message = error?.response?.data?.message ?? error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
