import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { BrowsePage } from "./pages/BrowsePage.jsx";
import { ListingDetailPage } from "./pages/ListingDetailPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { PosterDashboardPage } from "./pages/PosterDashboardPage.jsx";
import { ApplicantDashboardPage } from "./pages/ApplicantDashboardPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
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
