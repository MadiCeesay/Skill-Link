import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../src/api/auth';
import { session } from '../src/api/client';
import { Payment } from '../src/features/bookings';

afterEach(() => {
  cleanup();
  session.clear();
  vi.unstubAllGlobals();
});

function mountPayment(status) {
  session.set({ user: { id: 'customer', role: 'CUSTOMER' } });
  const fetcher = vi.fn(async (url) => {
    if (url.includes('/payments/')) return new Response(JSON.stringify({
      success: false, error: { code: status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        message: status === 404 ? 'Payment not found' : 'Payment access denied' },
    }), { status });
    return new Response(JSON.stringify({ success: true, data: { booking: {
      id: 'booking', status: 'AWAITING_PAYMENT', agreedAmountBututs: 45000,
    } } }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: {
    queries: { retry: false },
  } })}><AuthProvider><MemoryRouter initialEntries={['/app/bookings/booking/payment']}>
    <Routes><Route path="/app/bookings/:id/payment" element={<Payment />} /></Routes>
  </MemoryRouter></AuthProvider></QueryClientProvider>);
  return fetcher;
}

it('explains an unpaid booking without hiding the supported checkout action', async () => {
  mountPayment(404);
  expect(await screen.findByText('No payment simulation has been recorded for this booking.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run payment simulation' })).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows payment authorization failures and allows the read to be retried', async () => {
  const fetcher = mountPayment(403);
  expect(await screen.findByRole('alert')).toHaveTextContent('Payment access denied');
  const before = fetcher.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(fetcher.mock.calls.length).toBeGreaterThan(before);
});
