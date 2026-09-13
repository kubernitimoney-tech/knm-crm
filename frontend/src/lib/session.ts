export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const ACTIVITY_THROTTLE_MS = 1000;

export const LAST_ACTIVITY_KEY = 'lms_last_activity';

export function touchSession(): void {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function clearLastActivity(): void {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function getLastActivity(): number | null {
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSessionExpired(): boolean {
  const last = getLastActivity();
  if (!last) return false;
  return Date.now() - last >= SESSION_TIMEOUT_MS;
}

export function getRemainingSessionMs(): number {
  const last = getLastActivity();
  if (!last) return SESSION_TIMEOUT_MS;
  return Math.max(SESSION_TIMEOUT_MS - (Date.now() - last), 0);
}
