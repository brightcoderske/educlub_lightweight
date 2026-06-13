import apiClient from "../lib/api";

test("turns unauthorized API responses into a useful session message", async () => {
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
});
