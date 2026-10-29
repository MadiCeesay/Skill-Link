// Keep the local browser origin aligned with the backend's exact CORS policy.
// No production behavior or allowed backend origins are changed here.
export function localOriginRedirect(port) {
  return (request, response, next) => {
    if (port !== 5173 || request.headers.host !== '127.0.0.1:5173') return next();
    response.statusCode = 307;
    response.setHeader('Location', 'http://localhost:5173' + (request.url || '/'));
    response.end();
  };
}
