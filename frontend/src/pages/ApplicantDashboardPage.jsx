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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">My applications</h1>
      <p className="mt-1 text-gray-500">Welcome, {user?.name}.</p>

      <div className="mt-8 space-y-4">
        {status === "loading" && <p className="text-gray-500">Loading…</p>}
        {status === "error" && <p className="text-red-600">{error}</p>}
        {status === "ready" && applications.length === 0 && (
          <p className="text-gray-500">
            You haven't applied to anything yet.{" "}
            <Link to="/" className="underline">
              Browse listings
            </Link>
            .
          </p>
        )}

        {applications.map((app) => (
          <div key={app._id} className="rounded border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link to={`/listings/${app.listingId?._id}`} className="font-semibold hover:underline">
                  {app.listingId?.title ?? "Listing no longer available"}
                </Link>
                <p className="text-sm text-gray-500">{app.listingId?.location}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>

            <ol className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
              {app.statusHistory?.map((entry, i) => (
                <li key={i}>
                  <span className="font-medium text-gray-700">{entry.status}</span> —{" "}
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
