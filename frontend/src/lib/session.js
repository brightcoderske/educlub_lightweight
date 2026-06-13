export const AUTH_EXPIRED_EVENT = "educlub:auth-expired";
export const TOKEN_REFRESH_WINDOW_SECONDS = 10 * 60;

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

export function tokenSecondsRemaining(token, nowMs = Date.now()) {
  try {
    const payload = JSON.parse(decodeBase64Url(String(token || "").split(".")[1]));
    if (!Number.isFinite(Number(payload.exp))) return null;
    return Math.floor(Number(payload.exp) - nowMs / 1000);
  } catch {
    return null;
  }
}

export function shouldRefreshToken(token, nowMs = Date.now()) {
  const secondsRemaining = tokenSecondsRemaining(token, nowMs);
  return (
    secondsRemaining !== null &&
    secondsRemaining > 0 &&
    secondsRemaining <= TOKEN_REFRESH_WINDOW_SECONDS
  );
}

export function authResponseExpired(status, payload = {}) {
  if (status === 401) return true;
  if (status !== 403) return false;
  return /invalid or expired token|token expired/i.test(payload.error || payload.message || "");
}

export function dispatchAuthExpired() {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}
