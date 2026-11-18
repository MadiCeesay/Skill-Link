import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { api, session, refreshSession, restoreSession, ApiError } from '../src/api/client';
import { requestCooldown } from '../src/api/rate-limit';
const ok = (data) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const denied = () =>
  new Response(
    JSON.stringify({
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'Expired' },
    }),
    { status: 401 },
  );
beforeEach(() => {
  requestCooldown.reset();
  session.clear();
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  requestCooldown.reset();
  session.clear();
  vi.unstubAllGlobals();
});
it('unwraps real API envelopes and encodes filters', async () => {
  fetch.mockResolvedValue(ok({ workers: [] }));
  expect(
    await api('/workers', { params: { area: 'Brikama', unused: '' } }),
  ).toEqual({ workers: [] });
  expect(fetch.mock.calls[0][0]).toContain('/workers?area=Brikama');
});
it('explains the server rate-limit wait without retrying the request', async () => {
  fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      }),
      { status: 429, headers: { 'Retry-After': '120' } },
    ),
  );
  await expect(api('/workers')).rejects.toMatchObject({
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests Please wait 2 minutes before trying again.',
  });
  expect(fetch).toHaveBeenCalledOnce();
});
it('persists only the refresh token and removes it on sign-out', () => {
  session.set({
    accessToken: 'private-access',
    refreshToken: 'private-refresh',
  });
  expect(localStorage.length).toBe(1);
  expect(localStorage.getItem('skilllink.refreshToken')).toBe('private-refresh');
  expect(sessionStorage.length).toBe(0);
  session.clear();
  expect(localStorage.length).toBe(0);
});
it('restores a reload with one rotation and loads the current user using its access token', async () => {
  localStorage.setItem('skilllink.refreshToken', 'saved');
  const user = { id: 'admin', role: 'ADMIN' };
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      expect(JSON.parse(options.body)).toEqual({ refreshToken: 'saved' });
      return ok({ accessToken: 'access', refreshToken: 'next' });
    }
    expect(url).toContain('/auth/me');
    expect(options.headers.Authorization).toBe('Bearer access');
    return ok({ user });
  });
  await Promise.all([restoreSession(), restoreSession()]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(session.get().user).toEqual(user);
  expect(localStorage.getItem('skilllink.refreshToken')).toBe('next');
});
it.each([401, 429, 500])('clears a saved token if boot-time rotation fails with %s', async status => {
  localStorage.setItem('skilllink.refreshToken', 'saved');
  fetch.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status }));
  await restoreSession();
  expect(session.get()).toBe(null);
  expect(localStorage.length).toBe(0);
});
it('clears a restored token when loading its user fails', async () => {
  localStorage.setItem('skilllink.refreshToken', 'saved');
  fetch.mockResolvedValueOnce(ok({ accessToken: 'access', refreshToken: 'next' })).mockResolvedValueOnce(denied());
  await restoreSession();
  expect(session.get()).toBe(null);
  expect(localStorage.length).toBe(0);
});
it('does not overwrite a second tab rotation while loading the user', async () => {
  localStorage.setItem('skilllink.refreshToken', 'saved');
  fetch.mockResolvedValueOnce(ok({ accessToken: 'access', refreshToken: 'first-rotation' }));
  fetch.mockImplementationOnce(async () => {
    localStorage.setItem('skilllink.refreshToken', 'second-tab-rotation');
    return ok({ user: { id: 'customer', role: 'CUSTOMER' } });
  });
  await restoreSession();
  expect(localStorage.getItem('skilllink.refreshToken')).toBe('second-tab-rotation');
});
it('does not contact refresh when there is no saved token', async () => {
  await restoreSession();
  expect(fetch).not.toHaveBeenCalled();
});
it('shares one refresh for concurrent expired requests', async () => {
  session.set({ accessToken: 'old', refreshToken: 'refresh' });
  let refreshed = false;
  fetch.mockImplementation(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      refreshed = true;
      return ok({ accessToken: 'new', refreshToken: 'rotated' });
    }
    if (!refreshed) return denied();
    expect(options.headers.Authorization).toBe('Bearer new');
    return ok({ value: true });
  });
  const result = await Promise.all([
    api('/bookings/me'),
    api('/notifications/me'),
  ]);
  expect(result).toEqual([{ value: true }, { value: true }]);
  expect(
    fetch.mock.calls.filter(([u]) => u.endsWith('/auth/refresh')),
  ).toHaveLength(1);
  expect(session.get().refreshToken).toBe('rotated');
});
it('refreshes an expired access token before revoking logout', async () => {
  session.set({ accessToken: 'old', refreshToken: 'refresh' });
  let calls = 0;
  fetch.mockImplementation(async (url) => {
    if (url.endsWith('/auth/refresh'))
      return ok({ accessToken: 'new', refreshToken: 'rotated' });
    return ++calls === 1 ? denied() : ok({ message: 'Logged out' });
  });
  expect(await api('/auth/logout', { method: 'POST', body: {} })).toEqual({
    message: 'Logged out',
  });
  expect(calls).toBe(2);
});
it('never restores a session after logout during refresh', async () => {
  session.set({ accessToken: 'old', refreshToken: 'refresh' });
  let finish;
  fetch.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const pending = refreshSession();
  session.clear();
  finish(ok({ accessToken: 'new', refreshToken: 'rotated' }));
  await expect(pending).rejects.toThrow('session changed');
  expect(session.get()).toBe(null);
});
it('clears credentials when refresh is rejected', async () => {
  session.set({ accessToken: 'old', refreshToken: 'refresh' });
  fetch.mockResolvedValue(denied());
  await expect(api('/bookings/me')).rejects.toBeInstanceOf(ApiError);
  expect(session.get()).toBe(null);
});
it('preserves useful server validation messages', async () => {
  fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'CONTACT_SHARING_BLOCKED',
          message: 'Keep communication within SkillLink.',
        },
      }),
      { status: 400 },
    ),
  );
  await expect(
    api('/conversations/1/messages', { method: 'POST', body: {} }),
  ).rejects.toMatchObject({
    code: 'CONTACT_SHARING_BLOCKED',
    message: 'Keep communication within SkillLink.',
  });
});
it('clears suspended accounts and presents safe network errors', async () => {
  session.set({ accessToken: 'token', refreshToken: 'refresh' });
  fetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' },
      }),
      { status: 403 },
    ),
  );
  await expect(api('/bookings/me')).rejects.toMatchObject({
    code: 'ACCOUNT_INACTIVE',
  });
  expect(session.get()).toBe(null);
  fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
  await expect(api('/workers')).rejects.toMatchObject({
    code: 'NETWORK_ERROR',
    status: 0,
  });
});
