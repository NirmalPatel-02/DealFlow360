import { apiConfig } from './apiConfig';
import { ApiError } from './apiError';

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function rawRequest(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const requestUrl = path.startsWith('/api/') ? path : `${apiConfig.baseUrl}${path}`;
  const response = await fetch(requestUrl, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, data, 'Request failed');
  }

  return data;
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = rawRequest('/auth/refresh', { method: 'POST' })
    .then((data) => {
      setAccessToken(data.access_token);
      return data.access_token;
    })
    .catch((error) => {
      setAccessToken(null);
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  const { retry = true, auth = false, ...requestOptions } = options;

  try {
    return await rawRequest(path, { ...requestOptions, auth });
  } catch (error) {
    const shouldRefresh =
      retry &&
      auth &&
      error instanceof ApiError &&
      error.status === 401 &&
      path !== '/auth/refresh' &&
      path !== '/auth/login';

    if (!shouldRefresh) throw error;

    await refreshAccessToken();
    return rawRequest(path, { ...requestOptions, auth: true });
  }
}
