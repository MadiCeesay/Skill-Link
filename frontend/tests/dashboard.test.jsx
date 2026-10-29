import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/api/auth';
import { session } from '../src/api/client';
import {
  AdminOverview,
  RoleDashboard,
  Distribution,
  BookingTimeline,
} from '../src/features/dashboard-overview';
let clients;
let workerVisibility, identityStatus;
const metrics = {
  totalUsers: 23,
  verifiedWorkers: 5,
  completedBookings: 7,
  pendingDisputes: 0,
  pendingVerifications: 0,
  totalBookings: 10,
  confirmedBookings: 1,
  cancelledBookings: 2,
  disputedBookings: 0,
  openJobRequests: 3,
  reviews: 9,
  workers: 6,
  simulatedTransactionVolumeBututs: '100000',
  simulatedPlatformRevenueBututs: '10000',
  simulatedRefundsBututs: '5000',
};
beforeEach(() => {
  clients = [];
  workerVisibility = 'PUBLIC';
  identityStatus = 'APPROVED';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/workers/me/profile') && options.method === 'PATCH')
        workerVisibility = JSON.parse(options.body).profileVisibility;
      const data = path.endsWith('/metrics')
        ? metrics
        : path.endsWith('/finances/me')
          ? { pendingEarningsBututs: '12345', releasedEarningsBututs: '60000' }
          : path.endsWith('/workers/me/profile')
            ? {
                profile: {
                  completedJobsCount: 7,
                  reviewCount: 2,
                  averageRating: 4.5,
                  profileCompletion: 75,
                  profileVisibility: workerVisibility,
                  verificationSummary: { status: identityStatus },
                },
              }
            : {
                items: [],
                bookings: [],
                opportunities: [],
                jobRequests: [],
                proposals: [],
                verifications: [],
                pagination: { total: 0 },
              };
      return new Response(JSON.stringify({ success: true, data }));
    }),
  );
});
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  session.clear();
  vi.unstubAllGlobals();
});
function mount(role, node) {
  session.set({
    user: { id: 'fixture', firstName: 'Awa', role, accountStatus: 'ACTIVE' },
    accessToken: 'test-only',
  });
  const client = new QueryClient();
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
it('renders real admin metrics, honest empty queues and connected actions', async () => {
  mount('ADMIN', <AdminOverview />);
  expect(await screen.findByText('23')).toBeInTheDocument();
  expect(await screen.findByText('GMD 1,000.00')).toBeInTheDocument();
  expect(
    await screen.findByText('No pending verification applications.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Review applications' }),
  ).toHaveAttribute('href', '/admin/verifications');
  expect(
    screen.getByRole('img', {
      name: 'Current marketplace booking status totals',
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /withdraw/i }),
  ).not.toBeInTheDocument();
});
it('uses worker reputation and simulated balances without exposing admin widgets', async () => {
  mount('WORKER', <RoleDashboard />);
  expect(await screen.findByText('4.5')).toBeInTheDocument();
  expect(
    await screen.findByText('No upcoming bookings yet'),
  ).toBeInTheDocument();
  expect((await screen.findAllByText('GMD 123.45')).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'View earnings' })).toHaveAttribute(
    'href',
    '/work/earnings',
  );
  expect(screen.queryByText('Your review desk')).not.toBeInTheDocument();
});
it('explains approved draft profiles and offers publication without requesting forbidden opportunities', async () => {
  workerVisibility = 'DRAFT';
  mount('WORKER', <RoleDashboard />);
  expect(await screen.findByText('Your professional profile is still a draft.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publish profile' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Edit professional profile' })).toHaveAttribute('href', '/work/profile');
  expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/job-requests/opportunities'))).toBe(false);
  expect(screen.queryByText('This workspace is not available')).not.toBeInTheDocument();
});
it('publishes only after worker confirmation and then loads matched opportunities', async () => {
  workerVisibility = 'DRAFT';
  mount('WORKER', <RoleDashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Publish profile' }));
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish profile' }));
  expect((await screen.findAllByText('Public')).length).toBeGreaterThan(0);
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('/job-requests/opportunities'))).toBe(true));
  const request = fetch.mock.calls.find(([, options]) => options?.method === 'PATCH');
  expect(JSON.parse(request[1].body)).toEqual({ profileVisibility: 'PUBLIC' });
  expect(screen.queryByText('Your professional profile is still a draft.')).not.toBeInTheDocument();
});
it('guides public workers with pending identity verification without bypassing approval', async () => {
  identityStatus = 'PENDING';
  mount('WORKER', <RoleDashboard />);
  expect(await screen.findByText('A public professional profile and approved identity verification are required to see job opportunities.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Identity verification' })).toHaveAttribute('href', '/work/profile/verification');
  expect(screen.queryByRole('button', { name: 'Publish profile' })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => String(url).includes('/job-requests/opportunities'))).toBe(false);
});
it('shows customer-specific actions and excludes worker financial information', async () => {
  mount('CUSTOMER', <RoleDashboard />);
  expect(
    await screen.findByText('What’s your next project?'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Post your first job' }),
  ).toHaveAttribute('href', '/app/jobs/new');
  expect(
    screen.queryByText('Released earnings · simulated'),
  ).not.toBeInTheDocument();
});
it('keeps the dashboard shell visible while data is loading', () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  mount('ADMIN', <AdminOverview />);
  expect(
    screen.getByRole('heading', { name: 'The marketplace at a glance.' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
});
it('shows retryable API errors instead of invented metric values', async () => {
  fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        error: { message: 'Dashboard unavailable' },
      }),
      { status: 403 },
    ),
  );
  mount('ADMIN', <AdminOverview />);
  expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent(
    'Dashboard unavailable',
  );
  expect(
    screen.getAllByRole('button', { name: 'Try again' }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText('23')).not.toBeInTheDocument();
});
it('renders a zero-data chart as empty, without a fabricated distribution', () => {
  render(
    <Distribution
      label="Empty bookings"
      segments={[{ label: 'Completed', value: 0 }]}
    />,
  );
  expect(screen.getByText('No activity yet')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Empty bookings' })).toHaveStyle({
    background: '#f1eae2',
  });
});
it('shows only future, live appointments in chronological order', () => {
  const future = (offset) =>
    new Date(Date.now() + offset * 86400000).toISOString();
  const rows = [
    {
      id: 'later',
      description: 'Later appointment',
      status: 'CONFIRMED',
      scheduledStart: future(3),
    },
    {
      id: 'cancelled',
      description: 'Cancelled appointment',
      status: 'CANCELLED',
      scheduledStart: future(1),
    },
    {
      id: 'past',
      description: 'Past appointment',
      status: 'CONFIRMED',
      scheduledStart: future(-1),
    },
    {
      id: 'next',
      description: 'Next appointment',
      status: 'AWAITING_PAYMENT',
      scheduledStart: future(2),
    },
  ];
  render(
    <MemoryRouter>
      <BookingTimeline
        base="/work"
        query={{ data: { bookings: rows, pagination: { total: 4 } } }}
      />
    </MemoryRouter>,
  );
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '/work/bookings/next');
  expect(screen.queryByText('Past appointment')).not.toBeInTheDocument();
  expect(screen.queryByText('Cancelled appointment')).not.toBeInTheDocument();
});
it('treats a missing new-worker profile as onboarding rather than a broken dashboard', async () => {
  const normalFetch = fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) =>
      new URL(url).pathname.endsWith('/workers/me/profile')
        ? Promise.resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: { message: 'Complete onboarding first' },
              }),
              { status: 404 },
            ),
          )
        : normalFetch(url, options),
    ),
  );
  mount('WORKER', <RoleDashboard />);
  expect(
    await screen.findByText('Build your professional story'),
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create profile' })).toHaveAttribute(
    'href',
    '/work/profile',
  );
});
