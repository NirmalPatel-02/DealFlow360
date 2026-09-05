export class ApiError extends Error {
  constructor(status, data, message) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = data?.detail?.code || data?.code || null;
  }
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;

  const detail = error.data?.detail ?? error.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message;
    }
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        const loc = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join(' ') : '';
        const msg = item.msg || item.message;
        if (!msg) return '';
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean);

    if (messages.length) return messages.join('. ');
  }

  if (typeof error.message === 'string' && error.message && error.message !== 'Request failed') {
    return error.message;
  }

  return fallback;
}

export function getErrorCode(error) {
  return error?.code || error?.data?.detail?.code || null;
}
