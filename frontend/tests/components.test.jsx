import { it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, Guard } from '../src/api/auth';
import { session } from '../src/api/client';
import {
  WorkerCard,
  Command,
  QueryState,
  ProtectedAudio,
} from '../src/components/ui';
afterEach(() => session.clear());
it('keeps buffered audio stable across URL refresh and renews expired access at the same position', async () => {
  const renew = vi
    .fn()
    .mockResolvedValue({ data: { url: 'https://media.test/retry' } });
  const { container, rerender } = render(
    <ProtectedAudio url="https://media.test/initial" renew={renew} />,
  );
  const audio = container.querySelector('audio');
  audio.currentTime = 12;
  fireEvent.timeUpdate(audio);
  rerender(
    <ProtectedAudio
      url="https://media.test/background-renewal"
      renew={renew}
    />,
  );
  expect(audio).toHaveAttribute('src', 'https://media.test/initial');
  fireEvent.error(audio);
  await waitFor(() =>
    expect(audio).toHaveAttribute('src', 'https://media.test/retry'),
  );
  // Native media loading resets currentTime before new metadata arrives.
  audio.currentTime = 0;
  fireEvent.timeUpdate(audio);
  fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(12);
  expect(renew).toHaveBeenCalledOnce();
});
const mount = (node) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AuthProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
it('redirects unauthenticated private screens to sign in', async () => {
  mount(
    <Routes>
      <Route
        path="/"
        element={
          <Guard roles={['ADMIN']}>
            <p>Secret</p>
          </Guard>
        }
      />
      <Route path="/login" element={<p>Sign in page</p>} />
    </Routes>,
  );
  expect(await screen.findByText('Sign in page')).toBeInTheDocument();
  expect(screen.queryByText('Secret')).not.toBeInTheDocument();
});
it('enforces roles instead of merely hiding links', async () => {
  session.set({
    user: { id: 'customer', role: 'CUSTOMER' },
    accessToken: 'test',
  });
  mount(
    <Routes>
      <Route
        path="/"
        element={
          <Guard roles={['ADMIN']}>
            <p>Admin secret</p>
          </Guard>
        }
      />
      <Route path="/app" element={<p>Customer workspace</p>} />
    </Routes>,
  );
  expect(await screen.findByText('Customer workspace')).toBeInTheDocument();
  expect(screen.queryByText('Admin secret')).not.toBeInTheDocument();
});
it('allows an authorized administrator', () => {
  session.set({ user: { id: 'admin', role: 'ADMIN' }, accessToken: 'test' });
  mount(
    <Guard roles={['ADMIN']}>
      <p>Admin operations</p>
    </Guard>,
  );
  expect(screen.getByText('Admin operations')).toBeInTheDocument();
});
it('renders public marketplace DTOs without private fields', () => {
  const worker = {
    workerId: 'abc',
    name: { firstName: 'Awa', lastName: 'Sowe' },
    professionTitle: 'Electrician',
    services: [],
    serviceAreas: [{ name: 'Brikama' }],
    pricing: [],
    reviewCount: 0,
    email: 'never@expose.test',
    phoneNumber: '+2207000000',
    primaryLocation: { coordinates: [-16, 13] },
    verificationSummary: { identityVerified: true },
  };
  mount(<WorkerCard worker={worker} />);
  expect(screen.getByRole('heading', { name: 'Awa Sowe' })).toBeInTheDocument();
  expect(screen.getByText('New professional')).toBeInTheDocument();
  expect(document.body.textContent).not.toContain(worker.email);
  expect(document.body.textContent).not.toContain(worker.phoneNumber);
  expect(document.body.textContent).not.toContain('-16');
});
it('consequential actions wait for a confirmation dialog', () => {
  mount(
    <Command
      label="Cancel booking"
      path="/bookings/test/cancel"
      description="Release this reservation?"
    />,
  );
  expect(
    screen.queryByText('Release this reservation?'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
  expect(screen.getByText('Release this reservation?')).toBeInTheDocument();
  expect(document.querySelector('dialog').open).toBe(true);
});
it('shows safe loading and recoverable error states', () => {
  const { rerender } = render(<QueryState query={{ isPending: true }} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  const retry = vi.fn();
  rerender(
    <QueryState
      query={{ error: { message: 'No connection' }, refetch: retry }}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('No connection');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledOnce();
});
it('keeps loaded data during a rate limit but hides it after authorization is denied', () => {
  const { rerender } = render(<QueryState query={{ data: { label: 'Loaded record' }, error: { status: 429, message: 'Please wait' }, refetch: vi.fn() }}>{data => <p>{data.label}</p>}</QueryState>);
  expect(screen.getByText('Loaded record')).toBeInTheDocument();
  expect(screen.getByText('Showing your last loaded information.')).toBeInTheDocument();
  rerender(<QueryState query={{ data: { label: 'Loaded record' }, error: { status: 403, message: 'Access denied' } }}>{data => <p>{data.label}</p>}</QueryState>);
  expect(screen.queryByText('Loaded record')).not.toBeInTheDocument();
});
