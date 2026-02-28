import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlayerGamePage } from "../pages/PlayerGamePage";

const PLAYER_ID = "player-123";
const mockSend = vi.fn();
let capturedOnMessage: ((msg: unknown) => void) | null = null;

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: (opts: { onMessage: (msg: unknown) => void }) => {
    capturedOnMessage = opts.onMessage;
    return { send: mockSend };
  },
}));

beforeEach(() => {
  mockSend.mockClear();
  capturedOnMessage = null;
  // Simulate player identity in sessionStorage.
  sessionStorage.setItem("player_id", PLAYER_ID);
  sessionStorage.setItem("player_name", "Alice");
});

function renderPlayerGame(code = "123456") {
  return render(
    <MemoryRouter initialEntries={[`/game/${code}/play`]}>
      <Routes>
        <Route path="/game/:code/play" element={<PlayerGamePage />} />
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
        { id: "o-1", text: "3" },
        { id: "o-2", text: "4" },
        { id: "o-3", text: "5" },
        { id: "o-4", text: "6" },
      ],
    },
  },
};

describe("PlayerGamePage", () => {
  it("shows waiting spinner initially", () => {
    renderPlayerGame();
    expect(screen.getByText(/get ready/i)).toBeInTheDocument();
  });

  it("displays question and options on question message", () => {
    renderPlayerGame();
    act(() => capturedOnMessage!(fakeQuestion));
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /4/i })).toBeInTheDocument();
  });

  it("sends answer_submitted and locks options on selection", async () => {
    renderPlayerGame();
    act(() => capturedOnMessage!(fakeQuestion));

    const btn = screen.getByRole("button", { name: /4/i });
    await userEvent.click(btn);

    expect(mockSend).toHaveBeenCalledWith({
      type: "answer_submitted",
      payload: { question_id: "q-1", option_id: "o-2" },
    });
    expect(screen.getByText(/answer locked in/i)).toBeInTheDocument();

    // Clicking again should not send another message.
    mockSend.mockClear();
    await userEvent.click(btn);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("shows reveal with correct feedback for this player", () => {
    renderPlayerGame();
    act(() => capturedOnMessage!(fakeQuestion));
    act(() =>
      capturedOnMessage!({
        type: "answer_reveal",
        payload: {
          correct_option_id: "o-2",
          scores: {
            [PLAYER_ID]: { is_correct: true, points: 900, total_score: 900 },
          },
        },
      }),
    );
    expect(screen.getByText("Correct!")).toBeInTheDocument();
    expect(screen.getByText("+900")).toBeInTheDocument();
  });

  it("shows incorrect feedback when player chose wrong answer", () => {
    renderPlayerGame();
    act(() => capturedOnMessage!(fakeQuestion));
    act(() =>
      capturedOnMessage!({
        type: "answer_reveal",
        payload: {
          correct_option_id: "o-2",
          scores: {
            [PLAYER_ID]: { is_correct: false, points: 0, total_score: 500 },
          },
        },
      }),
    );
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("shows leaderboard with player highlighted", () => {
    renderPlayerGame();
    act(() =>
      capturedOnMessage!({
        type: "leaderboard",
        payload: {
          entries: [
            { player_id: PLAYER_ID, name: "Alice", score: 900, rank: 1 },
            { player_id: "other", name: "Bob", score: 400, rank: 2 },
          ],
        },
      }),
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/waiting for host/i)).toBeInTheDocument();
  });

  it("shows podium screen on game_over", () => {
    renderPlayerGame();
    act(() =>
      capturedOnMessage!({
        type: "podium",
        payload: {
          entries: [
            { player_id: PLAYER_ID, name: "Alice", score: 2700, rank: 1 },
            { player_id: "other", name: "Bob", score: 1800, rank: 2 },
          ],
        },
      }),
    );
    expect(screen.getByText(/game over/i)).toBeInTheDocument();
    // "2700" appears in both the hero score and the podium list.
    expect(screen.getAllByText("2700").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/your final score/i)).toBeInTheDocument();
  });

  it("shows play again link on podium screen", () => {
    renderPlayerGame();
    act(() =>
      capturedOnMessage!({
        type: "podium",
        payload: {
          entries: [{ player_id: PLAYER_ID, name: "Alice", score: 2700, rank: 1 }],
        },
      }),
    );
    const link = screen.getByRole("link", { name: /join a new game/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/join");
  });
});
