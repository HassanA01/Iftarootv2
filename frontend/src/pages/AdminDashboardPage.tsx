import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { admin, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-400">Iftaroot</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
        <p className="text-gray-400">Quiz management coming in issue #2.</p>
      </main>
    </div>
  );
}
