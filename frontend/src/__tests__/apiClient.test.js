import apiClient from "../lib/api";

test("turns unauthorized API responses into a useful session message", async () => {
  const expiryListener = jest.fn();
  window.addEventListener("educlub:auth-expired", expiryListener);
  const response = {
    headers: { get: () => "application/json" },
    json: async () => ({ error: "Access token required" }),
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  };

  await expect(apiClient.parseResponse(response)).rejects.toThrow(
    "Your session has expired. Please sign in again, then retry."
  );
  expect(expiryListener).toHaveBeenCalledTimes(1);
  window.removeEventListener("educlub:auth-expired", expiryListener);
});

test("does not expire the session for an ordinary permission denial", async () => {
  const expiryListener = jest.fn();
  window.addEventListener("educlub:auth-expired", expiryListener);
  const response = {
    headers: { get: () => "application/json" },
    json: async () => ({ error: "Insufficient permissions" }),
    ok: false,
    status: 403,
    statusText: "Forbidden",
  };

  await expect(apiClient.parseResponse(response)).rejects.toThrow("Insufficient permissions");
  expect(expiryListener).not.toHaveBeenCalled();
  window.removeEventListener("educlub:auth-expired", expiryListener);
});
