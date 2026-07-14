import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getMyApplications } from "../api/applications.js";
import { StatusBadge } from "../components/StatusBadge.jsx";

export function ApplicantDashboardPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyApplications()
      .then((data) => {
        setApplications(data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.response?.data?.error?.message ?? "Failed to load your applications");
        setStatus("error");
      });
  }, []);

  return (
    <main className="page-container max-w-2xl">
      <h1 className="text-3xl font-bold text-stone-900">My applications</h1>
      <p className="mt-1 text-stone-500">Welcome, {user?.name}.</p>

      <div className="mt-8 space-y-4">
        {status === "loading" && <p className="text-stone-500">Loading…</p>}
        {status === "error" && <p className="text-red-600">{error}</p>}
        {status === "ready" && applications.length === 0 && (
          <p className="text-stone-500">
            You haven't applied to anything yet.{" "}
            <Link to="/" className="font-medium text-emerald-600 underline">
              Browse listings
            </Link>
            .
          </p>
        )}

        {applications.map((app) => (
          <div key={app._id} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  to={`/listings/${app.listingId?._id}`}
                  className="font-semibold text-stone-900 hover:text-emerald-600 hover:underline"
                >
                  {app.listingId?.title ?? "Listing no longer available"}
                </Link>
                <p className="text-sm text-stone-500">{app.listingId?.location}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>

            <ol className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
              {app.statusHistory?.map((entry, i) => (
                <li key={i}>
                  <span className="font-medium text-stone-700">{entry.status}</span> —{" "}
                  {new Date(entry.changedAt).toLocaleString()}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </main>
  );
}
