import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";

let auth;
function Capture() {
  auth = useAuth();
  return null;
}

function reply(status, body, contentType) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => contentType },
    json: async () => body,
    text: async () => body,
  };
}

let container;
let root;
beforeEach(async () => {
  localStorage.clear();
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/authentication/sign-in"]}>
        <AuthProvider>
          <Capture />
        </AuthProvider>
      </MemoryRouter>
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  delete global.fetch;
});

test("a 200 page with no session is a sign-in failure, not a crash on role", async () => {
  global.fetch = jest.fn().mockResolvedValue(reply(200, "<html>Host error</html>", "text/html"));

  await expect(auth.login("learner1", "secret")).rejects.toThrow(
    "eduClub did not answer the sign-in properly"
  );
  expect(localStorage.getItem("token")).toBeNull();
  expect(localStorage.getItem("user")).toBeNull();
});

test("a learner sign-in with a session still signs in", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    reply(
      200,
      { token: "t", user: { id: 7, role: "learner", consentRequired: false } },
      "application/json"
    )
  );

  let result;
  await act(async () => {
    result = await auth.login("learner1", "secret");
  });
  expect(result).toEqual({ success: true });
  expect(auth.user.role).toBe("learner");
  expect(localStorage.getItem("token")).toBe("t");
});

test("the server's own refusal is still shown", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(reply(401, { error: "Invalid credentials" }, "application/json"));

  await expect(auth.login("learner1", "wrong")).rejects.toThrow("Invalid credentials");
});
