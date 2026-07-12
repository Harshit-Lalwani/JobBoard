import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getListing } from "../api/listings.js";
import { applyToListing } from "../api/applications.js";

export function ListingDetailPage() {
  const { id } = useParams();
  const { user, status } = useAuth();
  const [listing, setListing] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ resumeUrl: "", coverNote: "" });
  const [applyState, setApplyState] = useState("idle"); // idle | submitting | applied | error
  const [applyError, setApplyError] = useState(null);

  useEffect(() => {
    getListing(id)
      .then(setListing)
      .catch((err) => setLoadError(err.response?.data?.error?.message ?? "Listing not found"));
  }, [id]);

  async function handleApply(e) {
    e.preventDefault();
    setApplyState("submitting");
    setApplyError(null);
    try {
      await applyToListing(id, form);
      setApplyState("applied");
    } catch (err) {
      setApplyState("error");
      setApplyError(err.response?.data?.error?.message ?? "Failed to apply");
    }
  }

  if (loadError) {
    return (
      <main className="px-6 py-10">
        <p className="text-red-600">{loadError}</p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Back to listings
        </Link>
      </main>
    );
  }

  if (!listing) {
    return <main className="px-6 py-10 text-gray-500">Loading…</main>;
  }

  const canApply = status === "signed-in" && user?.role === "applicant";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/" className="text-sm text-gray-500 underline">
        Back to listings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{listing.title}</h1>
      <p className="mt-1 text-gray-500">{listing.location}</p>
      {listing.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 whitespace-pre-wrap text-gray-800">{listing.description}</p>

      <div className="mt-10 border-t border-gray-200 pt-6">
        {applyState === "applied" ? (
          <p className="text-green-700">Application submitted.</p>
        ) : canApply ? (
          <form onSubmit={handleApply} className="space-y-4">
            <h2 className="text-lg font-semibold">Apply to this listing</h2>
            <div>
              <label htmlFor="resumeUrl" className="block text-sm font-medium text-gray-700">
                Resume URL
              </label>
              <input
                id="resumeUrl"
                type="text"
                required
                value={form.resumeUrl}
                onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                placeholder="/uploads/my-resume.pdf"
              />
            </div>
            <div>
              <label htmlFor="coverNote" className="block text-sm font-medium text-gray-700">
                Cover note (optional)
              </label>
              <textarea
                id="coverNote"
                value={form.coverNote}
                onChange={(e) => setForm({ ...form, coverNote: e.target.value })}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                rows={4}
              />
            </div>
            {applyError && <p className="text-sm text-red-600">{applyError}</p>}
            <button
              type="submit"
              disabled={applyState === "submitting"}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {applyState === "submitting" ? "Submitting…" : "Apply"}
            </button>
          </form>
        ) : status === "signed-in" ? (
          <p className="text-sm text-gray-500">Only applicants can apply to listings.</p>
        ) : (
          <p className="text-sm text-gray-500">
            <Link to="/login" className="underline">
              Log in
            </Link>{" "}
            as an applicant to apply.
          </p>
        )}
      </div>
    </main>
  );
}
