export function getErrorMessage(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const responseMessage = error?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  const message = error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
