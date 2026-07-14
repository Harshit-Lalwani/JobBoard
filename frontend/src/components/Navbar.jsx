import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function Navbar() {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/80 px-6 py-4 backdrop-blur">
      <Link to="/" className="text-lg font-bold tracking-tight text-emerald-600">
        Job Board
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {status === "signed-in" && user ? (
          <>
            <Link
              to={user.role === "poster" ? "/poster" : "/applicant"}
              className="font-medium text-stone-700 transition hover:text-emerald-600"
            >
              Dashboard
            </Link>
            <span className="hidden text-stone-500 sm:inline">{user.name}</span>
            <button onClick={handleLogout} className="btn-secondary">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="font-medium text-stone-700 transition hover:text-emerald-600">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
