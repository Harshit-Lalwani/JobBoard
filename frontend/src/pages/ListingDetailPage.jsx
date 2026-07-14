import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getListing } from "../api/listings.js";
import { applyToListing } from "../api/applications.js";
import { uploadResume } from "../api/uploads.js";

export function ListingDetailPage() {
  const { id } = useParams();
  const { user, status } = useAuth();
  const [listing, setListing] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverNote, setCoverNote] = useState("");
  const [applyState, setApplyState] = useState("idle"); // idle | uploading | submitting | applied | error
  const [applyError, setApplyError] = useState(null);

  useEffect(() => {
    getListing(id)
      .then(setListing)
      .catch((err) => setLoadError(err.response?.data?.error?.message ?? "Listing not found"));
  }, [id]);

  async function handleApply(e) {
    e.preventDefault();
    setApplyError(null);
    try {
      setApplyState("uploading");
      const { url: resumeUrl } = await uploadResume(resumeFile);
      setApplyState("submitting");
      await applyToListing(id, { resumeUrl, coverNote });
      setApplyState("applied");
    } catch (err) {
      setApplyState("error");
      setApplyError(err.response?.data?.error?.message ?? "Failed to apply");
    }
  }

  if (loadError) {
    return (
      <main className="page-container max-w-2xl">
        <p className="text-red-600">{loadError}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-emerald-600 underline">
          Back to listings
        </Link>
      </main>
    );
  }

  if (!listing) {
    return <main className="page-container max-w-2xl text-stone-500">Loading…</main>;
  }

  const canApply = status === "signed-in" && user?.role === "applicant";
  const isBusy = applyState === "uploading" || applyState === "submitting";

  return (
    <main className="page-container max-w-2xl">
      <Link to="/" className="text-sm text-stone-500 hover:text-emerald-600">
        ← Back to listings
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-stone-900">{listing.title}</h1>
      <p className="mt-1 text-stone-500">{listing.location}</p>
      {listing.tags?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {listing.tags.map((tag) => (
            <li key={tag} className="tag-pill">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 whitespace-pre-wrap leading-relaxed text-stone-700">{listing.description}</p>

      <div className="mt-10">
        {applyState === "applied" ? (
          <div className="card border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="font-medium text-emerald-800">✓ Application submitted.</p>
          </div>
        ) : canApply ? (
          <form onSubmit={handleApply} className="card space-y-5 border-emerald-100 bg-emerald-50/40 p-6">
            <h2 className="text-lg font-semibold text-stone-900">Apply to this listing</h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">Resume (PDF)</label>
              <label
                htmlFor="resume"
                className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-5 transition ${
                  resumeFile
                    ? "border-emerald-400 bg-white"
                    : "border-emerald-300 bg-white hover:border-emerald-500 hover:bg-emerald-50"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
                    />
                  </svg>
                </span>
                <span className="min-w-0">
                  {resumeFile ? (
                    <>
                      <span className="block truncate font-medium text-stone-900">
                        {resumeFile.name}
                      </span>
                      <span className="text-xs text-emerald-600">Click to choose a different file</span>
                    </>
                  ) : (
                    <>
                      <span className="block font-medium text-emerald-700">
                        Click to upload your resume
                      </span>
                      <span className="text-xs text-stone-500">PDF only, up to 5MB</span>
                    </>
                  )}
                </span>
                <input
                  id="resume"
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <label htmlFor="coverNote" className="block text-sm font-medium text-stone-700">
                Cover note (optional)
              </label>
              <textarea
                id="coverNote"
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                className="input-field mt-1 bg-white"
                rows={4}
              />
            </div>
            {applyError && <p className="text-sm text-red-600">{applyError}</p>}
            <button type="submit" disabled={isBusy} className="btn-accent w-full sm:w-auto">
              {applyState === "uploading"
                ? "Uploading resume…"
                : applyState === "submitting"
                  ? "Submitting…"
                  : "Apply"}
            </button>
          </form>
        ) : status === "signed-in" ? (
          <p className="text-sm text-stone-500">Only applicants can apply to listings.</p>
        ) : (
          <p className="text-sm text-stone-500">
            <Link to="/login" className="font-medium text-emerald-600 underline">
              Log in
            </Link>{" "}
            as an applicant to apply.
          </p>
        )}
      </div>
    </main>
  );
}
