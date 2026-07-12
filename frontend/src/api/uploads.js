import { apiClient } from "./client.js";

export function uploadResume(file) {
  const formData = new FormData();
  formData.append("resume", file);
  return apiClient
    .post("/uploads/resume", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data);
}
