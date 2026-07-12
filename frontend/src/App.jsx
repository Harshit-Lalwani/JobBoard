import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { PosterDashboardPage } from "./pages/PosterDashboardPage.jsx";
import { ApplicantDashboardPage } from "./pages/ApplicantDashboardPage.jsx";

// Public browse/search/filter page lands here in Phase 10 — placeholder for now.
function HomePage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Job Board</h1>
        <p className="mt-2 text-gray-500">Browse and search listings land here in Phase 10.</p>
      </div>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute roles={["poster"]} />}>
          <Route path="/poster" element={<PosterDashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["applicant"]} />}>
          <Route path="/applicant" element={<ApplicantDashboardPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
