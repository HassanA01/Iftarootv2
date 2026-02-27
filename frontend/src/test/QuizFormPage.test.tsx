import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuizFormPage } from "../pages/QuizFormPage";

vi.mock("../api/quizzes", () => ({
  createQuiz: vi.fn(),
  updateQuiz: vi.fn(),
  getQuiz: vi.fn(),
}));

function renderForm(path = "/admin/quizzes/new") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/quizzes/new" element={<QuizFormPage />} />
          <Route path="/admin/quizzes/:quizID/edit" element={<QuizFormPage />} />
          <Route path="/admin/quizzes" element={<div>quiz list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("QuizFormPage — create mode", () => {
  it("renders create heading", () => {
    renderForm();
    expect(screen.getByText("New quiz")).toBeInTheDocument();
  });

  it("shows validation error when title is empty", async () => {
    renderForm();
    const submitBtn = screen.getByRole("button", { name: /create quiz/i });
    fireEvent.submit(submitBtn.closest("form")!);
    expect(await screen.findByText(/quiz title is required/i)).toBeInTheDocument();
  });

  it("shows validation error when no correct option selected", async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. General Knowledge/i), {
      target: { value: "My Quiz" },
    });
    fireEvent.change(screen.getByPlaceholderText("Question text"), {
      target: { value: "What is 2+2?" },
    });
    fireEvent.change(screen.getByPlaceholderText("Option 1"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("Option 2"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create quiz/i }));
    expect(
      await screen.findByText(/exactly one correct option/i)
    ).toBeInTheDocument();
  });

  it("can add and remove a question", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /add question/i }));
    expect(screen.getAllByPlaceholderText("Question text")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(screen.getAllByPlaceholderText("Question text")).toHaveLength(1);
  });

  it("can add an option up to 4", () => {
    renderForm();
    expect(screen.getAllByPlaceholderText(/Option \d/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(screen.getAllByPlaceholderText(/Option \d/)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(screen.getAllByPlaceholderText(/Option \d/)).toHaveLength(4);
    // button disappears at 4
    expect(screen.queryByRole("button", { name: /add option/i })).not.toBeInTheDocument();
  });
});
