// An empty address means the API is on the site's own address: requests go to
// /api. Only a missing setting (tests, tools run outside Vite) falls back.
const BACKEND_URL = globalThis.__EDUCLUB_API_URL__ ?? "http://localhost:4000";

const trimmedBackendUrl = BACKEND_URL.replace(/\/+$/, "");
const API_BASE_URL = trimmedBackendUrl.endsWith("/api")
  ? trimmedBackendUrl
  : `${trimmedBackendUrl}/api`;

// Where the API's own files (/uploads/...) are served: the API's address without
// /api. Empty when the API shares the site's address, so the path stays relative.
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

/** A server path such as /uploads/x.png as an address the page can load. */
export function apiAssetUrl(url) {
  if (!url) return "";
  return url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
}

export default API_BASE_URL;
