import { apiClient } from "./client.js";

export function register(data) {
  return apiClient.post("/auth/register", data).then((res) => res.data);
}

export function login(data) {
  return apiClient.post("/auth/login", data).then((res) => res.data);
}

export function refresh() {
  return apiClient.post("/auth/refresh").then((res) => res.data);
}

export function logout() {
  return apiClient.post("/auth/logout").then((res) => res.data);
}

export function me() {
  return apiClient.get("/auth/me").then((res) => res.data);
}
