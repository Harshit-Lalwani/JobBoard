import axios from "axios";

// The refresh token lives in an httpOnly cookie (see backend Phase 2), so this client always
// sends credentials; only the short-lived access token is handled here in JS.
export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let accessToken = null;
let onUnauthorized = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Called once from AuthProvider so this module can trigger a logout-like reset without a
 * circular import back into the auth context. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// On a 401, try exactly one silent refresh + retry. If that also fails, the session is
// genuinely gone (refresh cookie missing/expired/revoked) — clear state and let the caller's
// normal error handling (or the protected-route redirect) take over.
let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status !== 401 || config._retried || config.url === "/auth/refresh") {
      return Promise.reject(error);
    }
    config._retried = true;

    try {
      refreshPromise ??= apiClient.post("/auth/refresh").finally(() => {
        refreshPromise = null;
      });
      const { data } = await refreshPromise;
      setAccessToken(data.accessToken);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      onUnauthorized?.();
      return Promise.reject(refreshError);
    }
  }
);
