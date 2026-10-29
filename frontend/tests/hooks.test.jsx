import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAction, useApi } from '../src/api/hooks';
afterEach(() => vi.unstubAllGlobals());
it('sending a message refreshes history without reloading an unrelated worker profile', async () => {
  let messageReads = 0,
    profileReads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      let data;
      if (url.endsWith('/workers/me/profile')) {
        profileReads++;
        data = { profile: {} };
      } else if (options.method === 'POST') data = { message: { id: 'new' } };
      else if (url.endsWith('/messages')) {
        messageReads++;
        data = { count: messageReads };
      } else data = {};
      return new Response(JSON.stringify({ success: true, data }));
    }),
  );
  function Chat() {
    useApi('/workers/me/profile');
    const history = useApi('/conversations/c1/messages'),
      action = useAction();
    return (
      <>
        <span>History {history.data?.count}</span>
        <button
          onClick={() =>
            action.mutate({
              path: '/conversations/c1/messages',
              body: { type: 'TEXT', text: 'Hello' },
            })
          }
        >
          Send
        </button>
      </>
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    render(
      <QueryClientProvider client={client}>
        <Chat />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('History 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(screen.getByText('History 2')).toBeInTheDocument(),
    );
    expect(profileReads).toBe(1);
  } finally {
    client.clear();
  }
});
