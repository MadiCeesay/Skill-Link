import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { requestCooldown } from './rate-limit';
import { affectedPaths } from './invalidation';
export const apiKey = (path, params) => ['api', path, params || {}];
export function useApi(path, params, options = {}) {
  return useQuery({
    queryKey: apiKey(path, params),
    queryFn: ({ signal }) => api(path, { params, signal }),
    enabled: !!path,
    staleTime: 60000,
    retry: (n, e) => n < 1 && (!e.status || e.status >= 500),
    ...options,
    refetchInterval: (query) => {
      const cooldown = Math.max(requestCooldown.get(), query.state.error?.retryAt || 0);
      if (cooldown > Date.now()) return Math.max(cooldown - Date.now() + 1000, 1000);
      return typeof options.refetchInterval === 'function' ? options.refetchInterval(query) : options.refetchInterval ?? false;
    },
  });
}
export function useAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body = {}, method = 'POST' }) =>
      api(path, { body, method }),
    onSuccess: async (_data, { path }) => {
      const conversation = path.match(/^\/conversations\/([^/]+)\/messages$/);
      if (conversation || /^\/notifications\//.test(path)) {
        const paths = ['/notifications/me', '/notifications/unread-count'];
        if (conversation)
          paths.push(
            '/conversations/me',
            '/conversations/' + conversation[1] + '/messages',
          );
        await Promise.all(
          paths.map((resource) =>
            client.invalidateQueries({ queryKey: ['api', resource] }),
          ),
        );
        return;
      }
      await client.invalidateQueries({ queryKey: ['api'], refetchType: 'none' });
      const prefixes = affectedPaths(path);
      await client.refetchQueries({ type: 'active', predicate: (query) => query.queryKey[0] === 'api' && prefixes.some(prefix => String(query.queryKey[1]).startsWith(prefix)) });
      if (/^\/(categories|services)(\/|$)/.test(path))
        await client.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
export async function allCatalog(path, key, signal) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const data = await api(path, { params: { page, limit: 100 }, signal });
    rows.push(...data[key]);
    if (data[key].length < 100) break;
  }
  return rows;
}
export function useCatalog() {
  const categories = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: ({ signal }) => allCatalog('/categories', 'categories', signal),
    staleTime: 300000,
  });
  const services = useQuery({
    queryKey: ['catalog', 'services'],
    queryFn: ({ signal }) => allCatalog('/services', 'services', signal),
    staleTime: 300000,
  });
  return {
    categories: categories.data || [],
    services: services.data || [],
    isPending: categories.isPending || services.isPending,
    error: categories.error || services.error,
    refetch: () => Promise.all([categories.refetch(), services.refetch()]),
  };
}
