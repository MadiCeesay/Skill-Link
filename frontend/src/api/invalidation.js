// Mark other cached resources stale for the next visit, but only refresh active
// data affected by this operation. No mutation is retried automatically.
export function affectedPaths(path) {
  const common = ['/notifications/'];
  if (path.startsWith('/notifications/')) return common;
  if (path.startsWith('/conversations/')) {
    const match = path.match(/^\/conversations\/([^/]+)/);
    return [...common, '/conversations/me', ...(match ? ['/conversations/' + match[1]] : [])];
  }
  if (/^\/(categories|services)(\/|$)/.test(path)) return [...common, '/admin/catalog/', '/admin/metrics', '/workers'];
  if (path.startsWith('/admin/')) return [...common, '/admin/' + path.split('/')[2], '/admin/metrics'];
  if (path.startsWith('/workers/')) return [...common, '/workers/', '/job-requests/opportunities'];
  if (path.startsWith('/verifications')) return [...common, '/verifications', '/workers/'];
  if (path.startsWith('/availability/')) return [...common, '/availability/', '/workers/'];
  if (/^\/(job-requests|quotes)(\/|$)/.test(path)) return [...common, '/job-requests', '/quotes', '/bookings'];
  if (path.startsWith('/direct-proposals')) return [...common, '/direct-proposals', '/bookings'];
  if (path.startsWith('/payments/')) return [...common, '/payments/', '/bookings/', '/finances/'];
  if (/^\/(bookings|disputes)(\/|$)/.test(path)) return [...common, '/bookings/', '/disputes/', '/payments/', '/finances/', '/workers/'];
  return [path];
}
