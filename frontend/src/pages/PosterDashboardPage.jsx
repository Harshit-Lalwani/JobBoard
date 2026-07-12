import { useAuth } from "../context/AuthContext.jsx";

// Placeholder shell — Phase 11 fills this in with listings management + the applicant pipeline board.
export function PosterDashboardPage() {
  const { user } = useAuth();

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Poster dashboard</h1>
      <p className="mt-2 text-gray-500">
        Welcome, {user?.name}. Listing management and the applicant pipeline board land here in Phase 11.
      </p>
    </main>
  );
}
