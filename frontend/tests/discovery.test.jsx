import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Discovery, Services } from '../src/features/public';
const categories = [
  { id: 'a', name: 'Home' },
  { id: 'b', name: 'Clothing' },
];
const services = [
  { id: 's1', category: 'a', name: 'Electrician' },
  { id: 's2', category: 'b', name: 'Tailor' },
];
let failCatalog, clients;
const ok = (data) => new Response(JSON.stringify({ success: true, data }));
beforeEach(() => {
  failCatalog = false;
  clients = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('/workers'))
        return ok({ workers: [], pagination: { total: 0, totalPages: 0 } });
      if (failCatalog)
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Catalog unavailable' },
          }),
          { status: 503 },
        );
      return ok(path.endsWith('/categories') ? { categories } : { services });
    }),
  );
});
afterEach(() => {
  clients.forEach((c) => c.clear());
  vi.unstubAllGlobals();
});
function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function mount(node, path = '/professionals') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {node}
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it('limits services to their category and clears an incompatible selection', async () => {
  mount(<Discovery />, '/professionals?service=s1');
  const service = await screen.findByLabelText('Service');
  await waitFor(() => expect(service).not.toBeDisabled());
  expect(service).toHaveValue('s1');
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'b' },
  });
  expect(service).toHaveValue('');
  expect(
    screen.queryByRole('option', { name: 'Electrician' }),
  ).not.toBeInTheDocument();
  fireEvent.change(service, { target: { value: 's2' } });
  fireEvent.click(screen.getByRole('button', { name: /Apply filters/ }));
  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      'category=b&service=s2',
    ),
  );
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => url.includes('category=b&service=s2')),
    ).toBe(true),
  );
});
it('treats zero results as an empty search and offers clearing filters', async () => {
  mount(<Discovery />, '/professionals?q=unknown');
  expect(await screen.findByText('No professionals found')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Clear filters' }).at(-1),
  );
  await waitFor(() =>
    expect(screen.getByTestId('location')).toBeEmptyDOMElement(),
  );
});
it('shows a retryable catalog failure without a false empty state', async () => {
  failCatalog = true;
  mount(<Services />, '/services');
  expect(
    screen.getByRole('status', { name: 'Loading content' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Catalog unavailable',
  );
  expect(screen.queryByText('No services found')).not.toBeInTheDocument();
  failCatalog = false;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('heading', { name: 'Electrician' }),
  ).toBeInTheDocument();
});
