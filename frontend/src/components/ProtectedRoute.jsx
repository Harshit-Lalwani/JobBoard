import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/** Gates a subtree behind a signed-in session, optionally restricted to specific roles.
 * Waits for the initial silent-refresh check ("loading") before deciding whether to redirect,
 * so a page reload doesn't briefly bounce a still-valid session to /login. */
export function ProtectedRoute({ roles }) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (status === "signed-out" || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
