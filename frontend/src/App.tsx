import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { QuizListPage } from "./pages/QuizListPage";
import { QuizFormPage } from "./pages/QuizFormPage";
import { HostLobbyPage } from "./pages/HostLobbyPage";
import { HostGamePage } from "./pages/HostGamePage";
import { JoinPage } from "./pages/JoinPage";
import { PlayerLobbyPage } from "./pages/PlayerLobbyPage";
import { PlayerGamePage } from "./pages/PlayerGamePage";

const NotFound = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-center text-white">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-gray-400 mt-2">Page not found</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<QuizListPage />} />
            <Route path="quizzes" element={<QuizListPage />} />
            <Route path="quizzes/new" element={<QuizFormPage />} />
            <Route path="quizzes/:quizID/edit" element={<QuizFormPage />} />
            <Route path="host/:code" element={<HostLobbyPage />} />
            <Route path="game/:code" element={<HostGamePage />} />
          </Route>

          {/* Player-facing public routes */}
          <Route path="/join" element={<JoinPage />} />
          <Route path="/game/:code" element={<PlayerLobbyPage />} />
          <Route path="/game/:code/play" element={<PlayerGamePage />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
