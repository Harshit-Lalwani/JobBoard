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
    <nav className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
      <Link to="/" className="font-semibold">
        Job Board
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {status === "signed-in" && user ? (
          <>
            <Link to={user.role === "poster" ? "/poster" : "/applicant"} className="text-gray-700">
              Dashboard
            </Link>
            <span className="text-gray-500">{user.name}</span>
            <button onClick={handleLogout} className="text-gray-700 underline">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-700">
              Log in
            </Link>
            <Link to="/register" className="text-gray-700">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
