function loadWith(apiUrl) {
  let loaded;
  globalThis.__EDUCLUB_API_URL__ = apiUrl;
  jest.isolateModules(() => {
    loaded = require("lib/apiBase");
  });
  delete globalThis.__EDUCLUB_API_URL__;
  return loaded;
}

it("with the API on its own host, requests and uploads go there", () => {
  const api = loadWith("https://learn.educlub.co.ke");
  expect(api.default).toBe("https://learn.educlub.co.ke/api");
  expect(api.apiAssetUrl("/uploads/school-logos/a.png")).toBe(
    "https://learn.educlub.co.ke/uploads/school-logos/a.png"
  );
});

it("with the API on the site's own address, everything stays relative", () => {
  const api = loadWith("");
  expect(api.default).toBe("/api");
  expect(api.API_ORIGIN).toBe("");
  expect(api.apiAssetUrl("/uploads/school-logos/a.png")).toBe("/uploads/school-logos/a.png");
});

it("a full address is left as it is", () => {
  const api = loadWith("");
  expect(api.apiAssetUrl("https://cdn.example.org/a.png")).toBe("https://cdn.example.org/a.png");
  expect(api.apiAssetUrl("")).toBe("");
});
