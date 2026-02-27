import { Outlet, useNavigate, NavLink, useMatch } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useGameStore } from "../stores/gameStore";
import { endSession } from "../api/sessions";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, clearAuth } = useAuthStore();
  const { activeSession, clearActiveSession } = useGameStore();

  // Detect if the admin is currently on a live game page.
  const gameMatch = useMatch("/admin/game/:code");
  const isHostingGame = !!gameMatch;

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  async function handleEndGame() {
    if (!activeSession) return;
    try {
      await endSession(activeSession.sessionId);
    } finally {
      clearActiveSession();
      navigate("/admin", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-indigo-400">Iftaroot</h1>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/admin/quizzes"
              className={({ isActive }) =>
                `text-sm transition ${isActive ? "text-white font-medium" : "text-gray-400 hover:text-white"}`
              }
            >
              Quizzes
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{admin?.email}</span>
          {isHostingGame ? (
            <button
              onClick={handleEndGame}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition"
            >
              End Game
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
