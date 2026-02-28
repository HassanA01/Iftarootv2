import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { useGameStore } from "../stores/gameStore";
import type { WsMessage, LeaderboardEntry, PodiumEntry } from "../types";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8081";

// Host sees options WITH is_correct marked.
interface HostOption {
  id: string;
  text: string;
  is_correct: boolean;
}

interface HostQuestionPayload {
  question_index: number;
  total_questions: number;
  question: {
    id: string;
    text: string;
    time_limit: number;
    options: HostOption[];
  };
}

interface AnswerRevealPayload {
  correct_option_id: string;
  scores: Record<string, { is_correct: boolean; points: number; total_score: number }>;
}

type GamePhase = "waiting" | "question" | "reveal" | "leaderboard" | "podium";

const OPTION_COLORS = [
  "bg-red-600 hover:bg-red-500",
  "bg-blue-600 hover:bg-blue-500",
  "bg-yellow-500 hover:bg-yellow-400",
  "bg-green-600 hover:bg-green-500",
];

const OPTION_SHAPES = ["▲", "◆", "●", "■"];

export function HostGamePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const clearActiveSession = useGameStore((s) => s.clearActiveSession);

  // Warn host before closing the tab mid-game.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<HostQuestionPayload | null>(null);
  const [revealPayload, setRevealPayload] = useState<AnswerRevealPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [podium, setPodium] = useState<PodiumEntry[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [wsReady, setWsReady] = useState(false);

  const { send } = useWebSocket({
    url: `${WS_BASE}/api/v1/ws/host/${code}`,
    onOpen: () => setWsReady(true),
    onClose: () => setWsReady(false),
    onMessage: useCallback((msg: WsMessage) => {
      switch (msg.type) {
        case "question": {
          const p = msg.payload as HostQuestionPayload;
          setCurrentQuestion(p);
          setPhase("question");
          setAnsweredCount(0);
          setRevealPayload(null);
          break;
        }
        case "answer_submitted": {
          setAnsweredCount((n) => n + 1);
          break;
        }
        case "answer_reveal": {
          const p = msg.payload as AnswerRevealPayload;
          setRevealPayload(p);
          setPhase("reveal");
          break;
        }
        case "leaderboard": {
          const p = msg.payload as { entries: LeaderboardEntry[] };
          setLeaderboard(p.entries);
          setPhase("leaderboard");
          break;
        }
        case "podium": {
          const p = msg.payload as { entries: PodiumEntry[] };
          setPodium(p.entries);
          setPhase("podium");
          clearActiveSession();
          break;
        }
      }
    }, [clearActiveSession]),
    enabled: !!code,
  });

  const handleNextQuestion = () => {
    send({ type: "next_question", payload: {} });
  };

  const handleEndGame = () => {
    navigate("/admin");
  };

  // Waiting for first question
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-lg">Starting game…</p>
          <p className="text-gray-600 text-sm">
            {wsReady ? (
              <span className="text-green-400">● Connected</span>
            ) : (
              <span className="text-yellow-400">● Connecting…</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Podium
  if (phase === "podium") {
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          <h1 className="text-4xl font-black">Game Over!</h1>
          <div className="space-y-3">
            {podium.map((entry, i) => (
              <div
                key={entry.player_id}
                className="bg-gray-900 rounded-xl px-6 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{medals[i] ?? `#${entry.rank}`}</span>
                  <span className="font-semibold text-lg">{entry.name}</span>
                </div>
                <span className="text-indigo-400 font-bold text-xl">{entry.score}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleEndGame}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Leaderboard
  if (phase === "leaderboard") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-6">
          <h2 className="text-2xl font-bold text-center">Leaderboard</h2>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div
                key={entry.player_id}
                className="bg-gray-900 rounded-xl px-5 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 w-6 text-center font-bold">#{i + 1}</span>
                  <span className="font-medium">{entry.name}</span>
                </div>
                <span className="text-indigo-400 font-bold">{entry.score}</span>
              </div>
            ))}
          </div>
          {currentQuestion &&
            currentQuestion.question_index + 1 < currentQuestion.total_questions ? (
            <button
              onClick={handleNextQuestion}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition"
            >
              Next Question →
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition"
            >
              Show Final Results
            </button>
          )}
        </div>
      </div>
    );
  }

  // Question or Reveal
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="text-sm text-gray-400">
          Room <span className="font-mono text-indigo-400">{code}</span>
        </div>
        {currentQuestion && (
          <div className="text-sm text-gray-400">
            Question{" "}
            <span className="text-white font-bold">
              {currentQuestion.question_index + 1}
            </span>{" "}
            / {currentQuestion.total_questions}
          </div>
        )}
        <div className="text-sm">
          {wsReady ? (
            <span className="text-green-400">● Live</span>
          ) : (
            <span className="text-yellow-400">● Reconnecting</span>
          )}
        </div>
      </div>

      {currentQuestion && (
        <div className="flex-1 flex flex-col items-center px-6 py-8 max-w-3xl mx-auto w-full">
          {/* Question text */}
          <div className="w-full bg-gray-900 rounded-2xl p-8 text-center mb-6">
            <p className="text-2xl font-bold leading-snug">
              {currentQuestion.question.text}
            </p>
          </div>

          {/* Answer count */}
          {phase === "question" && (
            <p className="text-gray-400 text-sm mb-6">
              <span className="text-white font-bold">{answeredCount}</span> answered
            </p>
          )}

          {/* Options grid */}
          <div className="w-full grid grid-cols-2 gap-4">
            {currentQuestion.question.options.map((opt, i) => {
              const isCorrect = opt.is_correct;
              const revealed = phase === "reveal";
              let colorClass = OPTION_COLORS[i % 4];
              if (revealed) {
                colorClass = isCorrect
                  ? "bg-green-600"
                  : "bg-gray-700 opacity-50";
              }
              return (
                <div
                  key={opt.id}
                  className={`${colorClass} rounded-xl px-5 py-4 flex items-center gap-3 transition-all relative`}
                >
                  <span className="text-2xl font-black opacity-70">
                    {OPTION_SHAPES[i % 4]}
                  </span>
                  <span className="font-semibold text-sm flex-1">{opt.text}</span>
                  {revealed && isCorrect && (
                    <span className="text-white font-black">✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reveal scores summary */}
          {phase === "reveal" && revealPayload && (
            <div className="w-full mt-6 bg-gray-900 rounded-xl p-4">
              <p className="text-sm text-gray-400 text-center">
                {Object.values(revealPayload.scores).filter((s) => s.is_correct).length}{" "}
                of {Object.keys(revealPayload.scores).length} players answered correctly
              </p>
            </div>
          )}

          {/* Leaderboard auto-advances after reveal — host just waits */}
          {phase === "reveal" && (
            <p className="mt-4 text-gray-500 text-sm">Leaderboard coming up…</p>
          )}
        </div>
      )}
    </div>
  );
}
