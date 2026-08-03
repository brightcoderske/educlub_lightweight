const BACKEND_URL = globalThis.__EDUCLUB_API_URL__ || "http://localhost:4000";

const trimmedBackendUrl = BACKEND_URL.replace(/\/+$/, "");
const API_BASE_URL = trimmedBackendUrl.endsWith("/api")
  ? trimmedBackendUrl
  : `${trimmedBackendUrl}/api`;

export default API_BASE_URL;
