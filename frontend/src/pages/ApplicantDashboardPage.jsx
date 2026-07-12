import { useAuth } from "../context/AuthContext.jsx";

// Placeholder shell — Phase 12 fills this in with the applicant's own applications + statuses.
export function ApplicantDashboardPage() {
  const { user } = useAuth();

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold">My applications</h1>
      <p className="mt-2 text-gray-500">
        Welcome, {user?.name}. Your applications and their pipeline status land here in Phase 12.
      </p>
    </main>
  );
}
