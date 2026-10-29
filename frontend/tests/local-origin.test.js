import { it, expect, vi } from 'vitest';
import { localOriginRedirect } from '../scripts/local-origin.js';

it('redirects the alternate local hostname while preserving the requested route', () => {
  const response = { setHeader: vi.fn(), end: vi.fn() }, next = vi.fn();
  localOriginRedirect(5173)({ headers: { host: '127.0.0.1:5173' }, url: '/professionals?service=test' }, response, next);
  expect(response.statusCode).toBe(307);
  expect(response.setHeader).toHaveBeenCalledWith('Location', 'http://localhost:5173/professionals?service=test');
  expect(next).not.toHaveBeenCalled();
});

it('does not redirect the configured hostname, isolated test server or remote hosts', () => {
  for (const [port, host] of [[5173, 'localhost:5173'], [5174, '127.0.0.1:5174'], [5173, 'other.example']]) {
    const response = { setHeader: vi.fn(), end: vi.fn() }, next = vi.fn();
    localOriginRedirect(port)({ headers: { host }, url: '/' }, response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.end).not.toHaveBeenCalled();
  }
});
