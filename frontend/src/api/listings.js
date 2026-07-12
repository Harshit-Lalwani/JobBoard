import { apiClient } from "./client.js";

export function getListings(params = {}) {
  return apiClient.get("/listings", { params }).then((res) => res.data);
}

export function getListing(id) {
  return apiClient.get(`/listings/${id}`).then((res) => res.data);
}

export function createListing(data) {
  return apiClient.post("/listings", data).then((res) => res.data);
}

export function updateListing(id, data) {
  return apiClient.put(`/listings/${id}`, data).then((res) => res.data);
}

export function deleteListing(id) {
  return apiClient.delete(`/listings/${id}`).then((res) => res.data);
}
