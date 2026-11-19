import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/api/auth';
import { session } from '../src/api/client';
import { Bookings, BookingDetails } from '../src/features/bookings';
import { Messages } from '../src/features/messaging';
import { Notifications } from '../src/features/notifications';
import { AdminGap } from '../src/features/admin';
import { Field, Avatar } from '../src/components/ui';
import { bututs, gmdInput } from '../src/utils/format';

afterEach(() => { cleanup(); session.clear(); vi.unstubAllGlobals(); });
const person = role => ({ id: role === 'WORKER' ? 'customer' : 'worker', firstName: role === 'WORKER' ? 'Bruno' : 'Musa', lastName: role === 'WORKER' ? 'Ceesay' : 'Banja', profileImage: { url: 'https://media.example.test/photo' } });
const booking = role => ({ id: 'booking', customer: 'customer', worker: 'worker', service: 'service', counterpart: person(role), serviceSummary: { id: 'service', name: 'Electrician' }, status: 'COMPLETED', description: 'Repair the ceiling light.', agreedAmountBututs: 49979, createdAt: '2026-10-26T10:00:00Z', scheduledStart: '2026-10-27T10:00:00Z', scheduledEnd: '2026-10-27T12:00:00Z', startedAt: '2026-10-27T10:00:00Z', workerCompletedAt: '2026-10-27T11:00:00Z', completedAt: '2026-10-27T12:00:00Z' });
const pagination = { page: 1, totalPages: 1 };
function mount(Component, role, path, route = path) {
  session.set({ user: { id: role === 'WORKER' ? 'worker' : 'customer', role }, accessToken: 'test' });
  let read = false;
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    let data = {};
    if (url.includes('/payments/')) data = { payment: { status: 'RELEASED', paidAt: '2026-10-27T09:00:00Z' } };
    else if (url.includes('/bookings/me')) data = { bookings: [booking(role)], pagination };
    else if (url.includes('/bookings/booking')) data = { booking: booking(role), reviewEligibility: { canReview: false } };
    else if (url.includes('/conversations/me')) data = { conversations: [{ id: 'conversation', contextType: 'BOOKING', contextId: 'booking', counterpart: person(role), serviceSummary: { name: 'Electrician' }, status: 'COMPLETED' }], pagination };
    else if (url.includes('/messages')) data = { messages: [], pagination };
    else if (url.includes('/notifications/')) {
      if (options.method === 'POST') read = true;
      data = { notifications: [{ id: 'notice', type: 'BOOKING_WORKER_MARKED_COMPLETED', title: 'Work is ready for confirmation', message: 'Musa Banja marked your Electrician booking complete.', relatedResourceType: 'Booking', relatedResourceId: 'booking', readAt: read ? '2026-10-27T12:00:00Z' : null, createdAt: '2026-10-27T11:00:00Z' }], pagination };
    } else if (url.includes('/admin/metrics')) data = { openJobRequests: 0, acceptedJobs: 2 };
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  }));
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthProvider><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={<Component />} /></Routes></MemoryRouter></AuthProvider></QueryClientProvider>);
}
it.each(['CUSTOMER', 'WORKER'])('shows the other person, photo, service and status on %s booking lists', async role => {
  const { container } = mount(Bookings, role, role === 'WORKER' ? '/work/bookings' : '/app/bookings');
  expect(await screen.findByText(role === 'WORKER' ? 'Bruno Ceesay' : 'Musa Banja')).toBeVisible();
  expect(screen.getByText('Electrician')).toBeVisible();
  expect(screen.getByText('Completed')).toBeVisible();
  expect(screen.getByText('GMD 499.79')).toBeVisible();
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://media.example.test/photo');
});
it.each(['CUSTOMER', 'WORKER'])('shows the counterpart and a reached arranged milestone on completed %s booking details', async role => {
  mount(BookingDetails, role, '/app/bookings/booking', '/app/bookings/:id');
  expect(await screen.findByText(role === 'WORKER' ? 'Bruno Ceesay' : 'Musa Banja')).toBeVisible();
  expect(screen.getAllByText('Electrician')[0]).toBeVisible();
  const milestone = screen.getByText('Booked').closest('li');
  expect(milestone).toHaveClass('done');
  expect(within(milestone).queryByText('Not reached yet')).not.toBeInTheDocument();
});
it.each(['CUSTOMER', 'WORKER'])('identifies the other person, service and status in the %s conversation list', async role => {
  mount(Messages, role, '/app/messages');
  expect(await screen.findByText(role === 'WORKER' ? 'Bruno Ceesay' : 'Musa Banja')).toBeVisible();
  expect(screen.getByText('Electrician')).toBeVisible();
  expect(screen.getByText('Completed')).toBeVisible();
});
it('renders readable notification copy and an explicit unread marker that disappears after marking read', async () => {
  mount(Notifications, 'CUSTOMER', '/app/notifications');
  expect(await screen.findByText('Musa Banja marked your Electrician booking complete.')).toBeVisible();
  expect(screen.getByText('Unread')).toBeVisible();
  expect(screen.queryByText('Booking Worker Marked Completed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark notification read' }));
  await waitFor(() => expect(screen.queryByText('Unread')).not.toBeInTheDocument());
});
it('labels the global accepted-quote metric without implying it is the customer job count', async () => {
  mount(AdminGap, 'ADMIN', '/admin/jobs');
  expect(await screen.findByText('Requests with an accepted offer')).toBeVisible();
  expect(screen.getByText(/Private offers and archived bookings are not included/)).toBeVisible();
});
it('validates GMD precision, preserves cents and prevents wheel editing of a focused money input', () => {
  render(<Field label="Quote amount · GMD" type="number" step="0.01" min="0.01" required />);
  const input = screen.getByLabelText('Quote amount · GMD');
  fireEvent.change(input, { target: { value: '499.79' } });
  expect(input.checkValidity()).toBe(true);
  expect(bututs(input.value)).toBe(49979);
  expect(gmdInput(bututs(input.value))).toBe('499.79');
  input.focus();
  fireEvent.wheel(input, { deltaY: 100 });
  expect(input).not.toHaveFocus();
  expect(input.value).toBe('499.79');
  fireEvent.change(input, { target: { value: '499.791' } });
  expect(input.checkValidity()).toBe(false);
  expect(() => bututs(input.value)).toThrow(/two decimal places/);
});
it('falls back to initials when a profile image fails', () => {
  const { container } = render(<Avatar person={{ firstName: 'Musa', lastName: 'Banja' }} src="https://media.example.test/expired" />);
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('MB')).toBeVisible();
});
