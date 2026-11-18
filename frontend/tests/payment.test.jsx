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
  expect(await screen.findByText('No payment has been recorded for this booking.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
  expect(screen.getAllByText(/Simulated payment/)).toHaveLength(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('shows payment authorization failures and allows the read to be retried', async () => {
  const fetcher = mountPayment(403);
  expect(await screen.findByRole('alert')).toHaveTextContent('Payment access denied');
  const before = fetcher.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(fetcher.mock.calls.length).toBeGreaterThan(before);
});

it('sends the customer to Modem Pay when the live provider is active', async () => {
  const assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
  session.set({ user: { id: 'customer', role: 'CUSTOMER' } });
  const fetcher = vi.fn(async (url) => {
    const path = String(url);
    const json = (status, body) => new Response(JSON.stringify({ success: status < 400, ...body }), { status, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/payments/provider')) return json(200, { data: { provider: 'modempay', redirects: true } });
    if (path.endsWith('/checkout')) return json(200, { data: { redirectUrl: 'https://test.checkout.modempay.com/pi_1', payment: { id: 'p1', status: 'PENDING' } } });
    if (path.includes('/payments/bookings/')) return json(404, { error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    if (path.includes('/bookings/')) return json(200, { data: { booking: { id: 'b1', description: 'Fix roof', agreedAmountBututs: 65000, status: 'AWAITING_PAYMENT', scheduledStart: new Date().toISOString() } } });
    return json(404, { error: { code: 'NOT_FOUND', message: 'x' } });
  });
  vi.stubGlobal('fetch', fetcher);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthProvider><MemoryRouter initialEntries={['/app/bookings/b1/payment']}>
    <Routes><Route path="/app/bookings/:id/payment" element={<Payment />} /></Routes>
  </MemoryRouter></AuthProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: /with Modem Pay/ }));
  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://test.checkout.modempay.com/pi_1'));
  expect(screen.getByText(/Modem Pay test mode/)).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Payment result' })).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});
