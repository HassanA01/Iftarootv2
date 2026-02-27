import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuizListPage } from "../pages/QuizListPage";
import * as quizzesApi from "../api/quizzes";

vi.mock("../api/quizzes");

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/quizzes"]}>
        <Routes>
          <Route path="/admin/quizzes" element={<QuizListPage />} />
          <Route path="/admin/quizzes/new" element={<div>new quiz</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("QuizListPage", () => {
  it("shows empty state when no quizzes", async () => {
    vi.mocked(quizzesApi.listQuizzes).mockResolvedValue([]);
    renderList();
    expect(await screen.findByText(/no quizzes yet/i)).toBeInTheDocument();
  });

  it("shows quiz titles when data loads", async () => {
    vi.mocked(quizzesApi.listQuizzes).mockResolvedValue([
      { id: "1", admin_id: "a", title: "History Quiz", created_at: "2026-01-01T00:00:00Z" },
      { id: "2", admin_id: "a", title: "Science Quiz", created_at: "2026-01-02T00:00:00Z" },
    ]);
    renderList();
    expect(await screen.findByText("History Quiz")).toBeInTheDocument();
    expect(screen.getByText("Science Quiz")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    vi.mocked(quizzesApi.listQuizzes).mockRejectedValue(new Error("network error"));
    renderList();
    expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
  });
});
