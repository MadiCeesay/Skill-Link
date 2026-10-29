import { requestCooldown, retryAt } from './rate-limit';
export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');
let current = null,
  refreshing = null,
  epoch = 0;
const listeners = new Set();
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const session = {
  get: () => current,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(value) {
    epoch++;
    current = value;
    listeners.forEach((fn) => fn());
  },
  clear() {
    this.set(null);
  },
};
async function decode(response) {
  const body = await response.json().catch(() => ({}));
  const retryAfter = Number(response.headers.get('Retry-After'));
  const wait =
    response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
      ? ` Please wait ${Math.ceil(retryAfter / 60)} ${retryAfter <= 60 ? 'minute' : 'minutes'} before trying again.`
      : '';
  if (!response.ok || !body.success) {
    const error = new ApiError(
      response.status,
      body.error?.code || 'REQUEST_FAILED',
      (body.error?.message ||
        'We could not complete this request. Please try again.') + wait,
      body.error?.details,
    );
    if (response.status === 429) {
      error.retryAt = retryAt(response.headers.get('Retry-After'));
      if (response.headers.get('X-SkillLink-Rate-Limit') === 'global' || body.error?.message === 'Too many requests')
        requestCooldown.pause(error.retryAt);
    }
    throw error;
  }
  return body.data;
}
function respectCooldown() {
  const until = requestCooldown.get();
  if (!until) return;
  const error = new ApiError(429, 'RATE_LIMITED', 'SkillLink is receiving many requests. Your last loaded information is kept. Please wait before trying again.');
  error.retryAt = until;
  throw error;
}
export async function refreshSession() {
  if (refreshing) return refreshing;
  const original = epoch,
    token = current?.refreshToken;
  if (!token)
    throw new ApiError(401, 'SESSION_EXPIRED', 'Please sign in to continue.');
  refreshing = (async () => {
    try {
      respectCooldown();
      const data = await decode(
        await fetch(API_URL + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        }),
      );
      if (epoch !== original)
        throw new ApiError(
          401,
          'SESSION_CHANGED',
          'Your session changed. Please sign in again.',
        );
      session.set({ ...current, ...data });
      return current;
    } catch (error) {
      if (epoch === original && error.status !== 429) session.clear();
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
export async function api(
  path,
  { method = 'GET', body, params, signal, retry = true } = {},
) {
  respectCooldown();
  const q = new URLSearchParams(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== '',
    ),
  );
  const url = API_URL + path + (q.size ? '?' + q : '');
  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(current?.accessToken
          ? { Authorization: 'Bearer ' + current.accessToken }
          : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach SkillLink. Check your connection and try again.',
    );
  }
  if (
    response.status === 401 &&
    retry &&
    current?.refreshToken &&
    !['/auth/login', '/auth/refresh'].includes(path) &&
    !path.startsWith('/auth/register')
  ) {
    await refreshSession();
    return api(path, { method, body, params, signal, retry: false });
  }
  if (response.status === 401 && !path.startsWith('/auth/login'))
    session.clear();
  try {
    return await decode(response);
  } catch (error) {
    if (error.code === 'ACCOUNT_INACTIVE' || error.code === 'SESSION_REVOKED')
      session.clear();
    throw error;
  }
}
export function upload(file, purpose, onProgress = () => {}, retry = true) {
  return new Promise((resolve, reject) => {
    try { respectCooldown(); } catch (error) { reject(error); return; }
    if (!file || file.size > 5 * 1024 * 1024) {
      reject(
        new ApiError(
          413,
          'FILE_TOO_LARGE',
          'Choose a file no larger than 5 MB.',
        ),
      );
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_URL + '/media/' + purpose);
    if (current?.accessToken)
      xhr.setRequestHeader('Authorization', 'Bearer ' + current.accessToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          0,
          'NETWORK_ERROR',
          'The upload could not finish. Try again.',
        ),
      );
    xhr.onload = async () => {
      if (xhr.status === 401 && retry) {
        try {
          await refreshSession();
          resolve(await upload(file, purpose, onProgress, false));
        } catch (e) {
          reject(e);
        }
        return;
      }
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        reject(
          new ApiError(
            502,
            'UPLOAD_FAILED',
            'We could not read the upload response.',
          ),
        );
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && result.success)
        resolve(result.data.media);
      else {
        const error = new ApiError(
            xhr.status,
            result.error?.code,
            result.error?.message || 'Upload failed.',
          );
        if (xhr.status === 429) {
          error.retryAt = retryAt(xhr.getResponseHeader('Retry-After'));
          if (xhr.getResponseHeader('X-SkillLink-Rate-Limit') === 'global' || result.error?.message === 'Too many requests') requestCooldown.pause(error.retryAt);
        }
        reject(error);
      }
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
