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

test("downloads a PDF response with its server-provided filename", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name) =>
        name.toLowerCase() === "content-disposition"
          ? 'attachment; filename="educlub-lists.pdf"'
          : "application/pdf",
    },
    blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
  });

  const result = await apiClient.download("/courses/1/modules/2/pdf");

  expect(result.filename).toBe("educlub-lists.pdf");
  expect(result.blob.type).toBe("application/pdf");
  global.fetch = originalFetch;
});
