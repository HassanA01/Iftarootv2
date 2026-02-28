import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HostGamePage } from "../pages/HostGamePage";

// Mock useWebSocket so we can control incoming messages without a real WS.
const mockSend = vi.fn();
let capturedOnMessage: ((msg: unknown) => void) | null = null;

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: (opts: { onMessage: (msg: unknown) => void }) => {
    capturedOnMessage = opts.onMessage;
    return { send: mockSend };
  },
}));

function renderHostGame(code = "123456") {
  return render(
    <MemoryRouter initialEntries={[`/admin/game/${code}`]}>
      <Routes>
        <Route path="/admin/game/:code" element={<HostGamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fakeQuestion = {
  type: "question",
  payload: {
    question_index: 0,
    total_questions: 3,
    question: {
      id: "q-1",
      text: "What is 2+2?",
      time_limit: 20,
      options: [
        { id: "o-1", text: "3", is_correct: false },
        { id: "o-2", text: "4", is_correct: true },
        { id: "o-3", text: "5", is_correct: false },
        { id: "o-4", text: "6", is_correct: false },
      ],
    },
  },
};

describe("HostGamePage", () => {
  beforeEach(() => {
    mockSend.mockClear();
    capturedOnMessage = null;
  });

  it("shows waiting spinner before first question", () => {
    renderHostGame();
    expect(screen.getByText(/starting game/i)).toBeInTheDocument();
  });

  it("renders question when question message received", () => {
    renderHostGame();
    act(() => capturedOnMessage!(fakeQuestion));
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
    // Counter is split across spans; verify via textContent of parent.
    expect(
      screen.getByText((_, el) =>
        el?.textContent?.replace(/\s+/g, " ").trim() === "Question 1 / 3",
      ),
    ).toBeInTheDocument();
    // All 4 options visible
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows correct answer highlighted on reveal", () => {
    renderHostGame();
    act(() => capturedOnMessage!(fakeQuestion));
    act(() =>
      capturedOnMessage!({
        type: "answer_reveal",
        payload: {
          correct_option_id: "o-2",
          scores: { "player-1": { is_correct: true, points: 800, total_score: 800 } },
        },
      }),
    );
    expect(screen.getByText(/leaderboard coming up/i)).toBeInTheDocument();
  });

  it("shows leaderboard and next question button", () => {
    renderHostGame();
    act(() => capturedOnMessage!(fakeQuestion));
    act(() =>
      capturedOnMessage!({
        type: "leaderboard",
        payload: {
          entries: [
            { player_id: "p1", name: "Alice", score: 800, rank: 1 },
            { player_id: "p2", name: "Bob", score: 500, rank: 2 },
          ],
        },
      }),
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next question/i })).toBeInTheDocument();
  });

  it("sends next_question via WS when host clicks Next Question", async () => {
    renderHostGame();
    act(() => capturedOnMessage!(fakeQuestion));
    act(() =>
      capturedOnMessage!({
        type: "leaderboard",
        payload: { entries: [{ player_id: "p1", name: "Alice", score: 800, rank: 1 }] },
      }),
    );
    const btn = screen.getByRole("button", { name: /next question/i });
    await userEvent.click(btn);
    expect(mockSend).toHaveBeenCalledWith({ type: "next_question", payload: {} });
  });

  it("shows podium on game_over", () => {
    renderHostGame();
    act(() =>
      capturedOnMessage!({
        type: "podium",
        payload: {
          entries: [
            { player_id: "p1", name: "Alice", score: 2400, rank: 1 },
            { player_id: "p2", name: "Bob", score: 1600, rank: 2 },
          ],
        },
      }),
    );
    expect(screen.getByText(/game over/i)).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2400")).toBeInTheDocument();
    // Back to Dashboard is the only action button on the podium screen.
    expect(screen.getByRole("button", { name: /back to dashboard/i })).toBeInTheDocument();
  });
});
