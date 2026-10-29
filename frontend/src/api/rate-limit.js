let globalUntil = 0;
export function retryAt(value, now = Date.now()) {
  if (!value) return now + 60000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? date : now + 60000;
}
export const requestCooldown = {
  get: () => globalUntil > Date.now() ? globalUntil : 0,
  pause(until) { globalUntil = Math.max(globalUntil, until); },
  reset() { globalUntil = 0; },
};
