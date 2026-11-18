import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JobAssistant } from '../src/components/JobAssistant';

let available, requests;
const draft = {
  title: 'Repair roof leak above the bedroom',
  description: 'Water drips through the bedroom ceiling when it rains and needs a roof repair.',
  service: { id: 's1', name: 'Masonry' },
  confidence: 0.8,
  urgency: 'URGENT',
  followUpQuestions: ['Is the roof zinc or concrete?'],
  priceRange: { minBututs: 80000, maxBututs: 150000, source: 'AI_ESTIMATE' },
  safetyNote: 'Keep water away from sockets.',
  transcript: null,
  detectedLanguage: null,
};
beforeEach(() => {
  available = true;
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = new URL(url).pathname;
    requests.push({ path, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    const data = path.endsWith('/assistant/status') ? { jobDraft: available } : { draft };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = (onApply = () => {}) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <JobAssistant onApply={onApply} />
  </QueryClientProvider>,
);

it('stays hidden when the server has no AI key', async () => {
  available = false;
  const { container } = show();
  await waitFor(() => expect(requests.some(r => r.path.endsWith('/assistant/status'))).toBe(true));
  expect(container).toBeEmptyDOMElement();
});

it('writes a draft from a rough description and lets the customer use it', async () => {
  const onApply = vi.fn();
  show(onApply);
  const box = await screen.findByLabelText('What is the problem?');
  const button = screen.getByRole('button', { name: /write it for me/i });
  expect(button).toBeDisabled();
  fireEvent.change(box, { target: { value: 'water coming from ceiling when rain' } });
  fireEvent.click(button);
  expect(await screen.findByText(draft.title)).toBeInTheDocument();
  expect(requests.find(r => r.path.endsWith('/assistant/job-draft')).body).toEqual({ text: 'water coming from ceiling when rain' });
  expect(screen.getByText('AI suggestion · check it before posting')).toBeInTheDocument();
  expect(screen.getByText('Masonry')).toBeInTheDocument();
  expect(screen.getByText(/rough AI estimate/)).toBeInTheDocument();
  expect(screen.getByText(/Keep water away from sockets/)).toBeInTheDocument();
  expect(screen.getByText('Is the roof zinc or concrete?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
  expect(onApply).toHaveBeenCalledWith(draft, []);
});
