// API client for making requests to the backend
import API_BASE_URL from "lib/apiBase";

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
      if (response.status === 401) {
        throw new Error("Your session has expired. Please sign in again, then retry.");
      }
      throw new Error(payload.error || payload.message || "Request failed");
    }

    return payload;
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.parseResponse(response);
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.parseResponse(response);
  }

  async put(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    return this.parseResponse(response);
  }

  async delete(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    return this.parseResponse(response);
  }
}

const apiClient = new ApiClient();

export { apiClient };
export { parseApiResponse };
export default apiClient;
