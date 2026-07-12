import { apiClient } from "./client.js";

export function applyToListing(listingId, data) {
  return apiClient.post(`/applications/${listingId}/apply`, data).then((res) => res.data);
}

export function getApplicationsForListing(listingId) {
  return apiClient.get(`/applications/listing/${listingId}`).then((res) => res.data);
}

export function updateApplicationStatus(applicationId, status) {
  return apiClient
    .put(`/applications/${applicationId}/status`, { status })
    .then((res) => res.data);
}

export function getApplication(applicationId) {
  return apiClient.get(`/applications/${applicationId}`).then((res) => res.data);
}
