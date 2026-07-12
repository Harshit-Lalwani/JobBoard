import { useEffect, useState } from "react";
import { getApplicationsForListing, updateApplicationStatus } from "../api/applications.js";
import { getLegalTransitions, APPLICATION_STATUSES } from "../utils/statusMachine.js";

const STATUS_LABELS = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export function PipelineBoard({ listingId }) {
  const [applications, setApplications] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [movingId, setMovingId] = useState(null);

  useEffect(() => {
    setStatus("loading");
    getApplicationsForListing(listingId)
      .then((apps) => {
        setApplications(apps);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message ?? "Failed to load applicants");
        setStatus("error");
      });
  }, [listingId]);

  async function handleMove(applicationId, nextStatus) {
    setMovingId(applicationId);
    try {
      const updated = await updateApplicationStatus(applicationId, nextStatus);
      setApplications((prev) => prev.map((a) => (a._id === applicationId ? updated : a)));
    } catch (err) {
      setError(err.response?.data?.error?.message ?? "Failed to update status");
    } finally {
      setMovingId(null);
    }
  }

  if (status === "loading") {
    return <p className="text-gray-500">Loading applicants…</p>;
  }

  if (status === "error" && applications.length === 0) {
    return <p className="text-red-600">{error}</p>;
  }

  if (applications.length === 0) {
    return <p className="text-gray-500">No applicants yet.</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 overflow-x-auto sm:grid-cols-5">
        {APPLICATION_STATUSES.map((columnStatus) => (
          <div key={columnStatus} className="min-w-[180px]">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              {STATUS_LABELS[columnStatus]}
            </h3>
            <div className="space-y-2">
              {applications
                .filter((app) => app.status === columnStatus)
                .map((app) => (
                  <div key={app._id} className="rounded border border-gray-200 p-3 text-sm">
                    <p className="font-medium">{app.applicantId?.name}</p>
                    <p className="text-gray-500">{app.applicantId?.email}</p>
                    {app.coverNote && (
                      <p className="mt-1 line-clamp-3 text-gray-600">{app.coverNote}</p>
                    )}
                    <a
                      href={app.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-gray-500 underline"
                    >
                      Resume
                    </a>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getLegalTransitions(app.status).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          onClick={() => handleMove(app._id, nextStatus)}
                          disabled={movingId === app._id}
                          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {STATUS_LABELS[nextStatus]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
