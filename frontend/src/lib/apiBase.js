const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

const trimmedBackendUrl = BACKEND_URL.replace(/\/+$/, "");
const API_BASE_URL = trimmedBackendUrl.endsWith("/api")
  ? trimmedBackendUrl
  : `${trimmedBackendUrl}/api`;

export default API_BASE_URL;
