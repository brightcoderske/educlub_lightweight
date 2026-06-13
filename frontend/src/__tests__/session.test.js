import { authResponseExpired, shouldRefreshToken, tokenSecondsRemaining } from "../lib/session";

function tokenWithExpiry(expiresAtSeconds) {
  const payload = btoa(JSON.stringify({ exp: expiresAtSeconds }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${payload}.signature`;
}

test("refreshes an active session only when the token is close to expiry", () => {
  const nowSeconds = 1_800_000_000;

  expect(shouldRefreshToken(tokenWithExpiry(nowSeconds + 601), nowSeconds * 1000)).toBe(false);
  expect(shouldRefreshToken(tokenWithExpiry(nowSeconds + 599), nowSeconds * 1000)).toBe(true);
  expect(tokenSecondsRemaining(tokenWithExpiry(nowSeconds + 90), nowSeconds * 1000)).toBe(90);
});

test("invalid tokens are treated as expired", () => {
  expect(shouldRefreshToken("not-a-jwt", Date.now())).toBe(false);
  expect(tokenSecondsRemaining("not-a-jwt", Date.now())).toBeNull();
});

test("only authentication failures expire the local session", () => {
  expect(authResponseExpired(401, { error: "Access token required" })).toBe(true);
  expect(authResponseExpired(403, { error: "Invalid or expired token" })).toBe(true);
  expect(authResponseExpired(403, { error: "Insufficient permissions" })).toBe(false);
});
