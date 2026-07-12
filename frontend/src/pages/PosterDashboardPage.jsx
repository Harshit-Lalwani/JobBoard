import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getMyListings, createListing, updateListing, deleteListing } from "../api/listings.js";
import { ListingForm } from "../components/ListingForm.jsx";
import { PipelineBoard } from "../components/PipelineBoard.jsx";

export function PosterDashboardPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pipelineListingId, setPipelineListingId] = useState(null);

  function loadListings() {
    setStatus("loading");
    getMyListings()
      .then((data) => {
        setListings(data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message ?? "Failed to load your listings");
        setStatus("error");
      });
  }

  useEffect(loadListings, []);

  async function handleCreate(data) {
    await createListing(data);
    setShowCreateForm(false);
    loadListings();
  }

  async function handleUpdate(id, data) {
    await updateListing(id, data);
    setEditingId(null);
    loadListings();
  }

  async function handleToggleStatus(listing) {
    const nextStatus = listing.status === "open" ? "closed" : "open";
    await updateListing(listing._id, { status: nextStatus });
    loadListings();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    await deleteListing(id);
    if (pipelineListingId === id) setPipelineListingId(null);
    loadListings();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Poster dashboard</h1>
      <p className="mt-1 text-gray-500">Welcome, {user?.name}.</p>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My listings</h2>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
            >
              New listing
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="mt-4">
            <ListingForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              submitLabel="Create listing"
            />
          </div>
        )}

        {status === "loading" && <p className="mt-4 text-gray-500">Loading…</p>}
        {status === "error" && <p className="mt-4 text-red-600">{error}</p>}

        <div className="mt-4 space-y-3">
          {listings.map((listing) =>
            editingId === listing._id ? (
              <ListingForm
                key={listing._id}
                initial={listing}
                onSubmit={(data) => handleUpdate(listing._id, data)}
                onCancel={() => setEditingId(null)}
                submitLabel="Save changes"
              />
            ) : (
              <div key={listing._id} className="rounded border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{listing.title}</h3>
                    <p className="text-sm text-gray-500">
                      {listing.location} ·{" "}
                      <span className={listing.status === "open" ? "text-green-700" : "text-gray-500"}>
                        {listing.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      onClick={() =>
                        setPipelineListingId(pipelineListingId === listing._id ? null : listing._id)
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      {pipelineListingId === listing._id ? "Hide applicants" : "View applicants"}
                    </button>
                    <button
                      onClick={() => setEditingId(listing._id)}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(listing)}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      {listing.status === "open" ? "Close" : "Reopen"}
                    </button>
                    <button
                      onClick={() => handleDelete(listing._id)}
                      className="rounded border border-red-300 px-2 py-1 text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {pipelineListingId === listing._id && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <PipelineBoard listingId={listing._id} />
                  </div>
                )}
              </div>
            )
          )}
          {status === "ready" && listings.length === 0 && !showCreateForm && (
            <p className="text-gray-500">You haven't posted any listings yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
