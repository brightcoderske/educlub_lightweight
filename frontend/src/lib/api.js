// API client for making requests to the backend
import API_BASE_URL from "lib/apiBase";
import {
  authResponseExpired,
  dispatchAuthExpired,
  shouldRefreshToken,
  tokenSecondsRemaining,
} from "lib/session";

let refreshPromise = null;

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      return { error: "Server returned an invalid JSON response." };
    }
  }

  const text = await response.text();
  return { error: text || response.statusText || "Request failed" };
}

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getHeaders() {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async parseResponse(response) {
    const payload = await parseApiResponse(response);

    if (!response.ok) {
      if (authResponseExpired(response.status, payload)) {
        dispatchAuthExpired();
        throw new Error("Your session has expired. Please sign in again, then retry.");
      }
      const error = new Error(payload.error || payload.message || "Request failed");
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async refreshSessionIfNeeded(force = false) {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const secondsRemaining = tokenSecondsRemaining(token);
    if (!force && secondsRemaining !== null && secondsRemaining > 0 && !shouldRefreshToken(token)) return null;
    if (refreshPromise) return refreshPromise;

    refreshPromise = fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: this.getHeaders(),
      credentials: "include",
    })
      .then((response) => this.parseResponse(response))
      .then((payload) => {
        if (payload?.token) localStorage.setItem("token", payload.token);
        if (payload?.user) localStorage.setItem("user", JSON.stringify(payload.user));
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async request(method, endpoint, data) {
    if (endpoint !== "/auth/refresh") {
      await this.refreshSessionIfNeeded();
    }

    const options = {
      method,
      headers: this.getHeaders(),
      credentials: "include",
    };
    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    return this.parseResponse(response);
  }

  async get(endpoint) {
    return this.request("GET", endpoint);
  }

  async download(endpoint) {
    await this.refreshSessionIfNeeded();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      return this.parseResponse(response);
    }

    const disposition = response.headers.get("content-disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    return {
      blob: await response.blob(),
      filename: filenameMatch?.[1] || "educlub-module.pdf",
    };
  }

  async post(endpoint, data) {
    return this.request("POST", endpoint, data);
  }

  async put(endpoint, data) {
    return this.request("PUT", endpoint, data);
  }

  async delete(endpoint) {
    return this.request("DELETE", endpoint);
  }
}

const apiClient = new ApiClient();

export { apiClient };
export { parseApiResponse };
export default apiClient;
