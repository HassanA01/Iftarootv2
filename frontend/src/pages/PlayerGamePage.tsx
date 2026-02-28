import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import { LeaderboardDisplay } from "../components/LeaderboardDisplay";
import type { WsMessage, QuestionPayload, LeaderboardEntry, PodiumEntry } from "../types";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8081";

const OPTION_COLORS = [
  { bg: "bg-red-600", hover: "hover:bg-red-500", selected: "ring-4 ring-white" },
  { bg: "bg-blue-600", hover: "hover:bg-blue-500", selected: "ring-4 ring-white" },
  { bg: "bg-yellow-500", hover: "hover:bg-yellow-400", selected: "ring-4 ring-white" },
  { bg: "bg-green-600", hover: "hover:bg-green-500", selected: "ring-4 ring-white" },
];
const OPTION_SHAPES = ["▲", "◆", "●", "■"];

interface RevealScore {
  is_correct: boolean;
  points: number;
  total_score: number;
}

interface AnswerRevealPayload {
  correct_option_id: string;
  scores: Record<string, RevealScore>;
}

type GamePhase = "waiting" | "question" | "reveal" | "leaderboard" | "podium" | "ended";

function CountdownRing({
  timeLimit,
  startedAt,
}: {
  timeLimit: number;
  startedAt: number;
}) {
  const [remaining, setRemaining] = useState(timeLimit);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, timeLimit - elapsed);
      setRemaining(left);
      if (left <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeLimit, startedAt]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / timeLimit;
  const strokeDashoffset = circumference * (1 - progress);
  const color = remaining > timeLimit * 0.5 ? "#4ade80" : remaining > timeLimit * 0.25 ? "#facc15" : "#f87171";

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="text-2xl font-black tabular-nums">{Math.ceil(remaining)}</span>
    </div>
  );
}

export function PlayerGamePage() {
  const { code } = useParams<{ code: string }>();
  const playerId = sessionStorage.getItem("player_id") ?? "";

  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [revealPayload, setRevealPayload] = useState<AnswerRevealPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [prevLeaderboard, setPrevLeaderboard] = useState<LeaderboardEntry[]>([]);
  const leaderboardRef = useRef<LeaderboardEntry[]>([]);
  const [podium, setPodium] = useState<PodiumEntry[]>([]);

  const { send } = useWebSocket({
    url: `${WS_BASE}/api/v1/ws/player/${code}?player_id=${playerId}&name=${encodeURIComponent(
      sessionStorage.getItem("player_name") ?? "",
    )}`,
    onMessage: useCallback(
      (msg: WsMessage) => {
        switch (msg.type) {
          case "question": {
            const p = msg.payload as QuestionPayload;
            setCurrentQuestion(p);
            setPhase("question");
            setSelectedOptionId(null);
            setRevealPayload(null);
            setQuestionStartedAt(Date.now());
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
            setPrevLeaderboard(leaderboardRef.current);
            leaderboardRef.current = p.entries;
            setLeaderboard(p.entries);
            setPhase("leaderboard");
            break;
          }
          case "podium": {
            const p = msg.payload as { entries: PodiumEntry[] };
            setPodium(p.entries);
            setPhase("podium");
            break;
          }
          case "game_over": {
            const p = msg.payload as { reason?: string };
            if (p.reason === "session_ended") {
              setPhase("ended");
            }
            break;
          }
        }
      },
      [],
    ),
    enabled: !!code && !!playerId,
  });

  const handleSelectOption = (optionId: string, questionId: string) => {
    if (selectedOptionId) return; // already answered
    setSelectedOptionId(optionId);
    send({
      type: "answer_submitted",
      payload: { question_id: questionId, option_id: optionId },
    });
  };

  // Host ended the game early
  if (phase === "ended") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">🚫</div>
          <h1 className="text-2xl font-bold">Game Ended</h1>
          <p className="text-gray-400">The host ended the session early.</p>
          <a
            href="/join"
            className="inline-block mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            Join another game
          </a>
        </div>
      </div>
    );
  }

  // Waiting screen
  if (phase === "waiting") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Get ready…</p>
        </div>
      </div>
    );
  }

  // Podium
  if (phase === "podium") {
    const myEntry = podium.find((e) => e.player_id === playerId);
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-3xl font-black">Game Over!</h1>
          {myEntry && (
            <div className="bg-indigo-900/40 border border-indigo-700 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Your final score</p>
              <p className="text-4xl font-black text-indigo-300">{myEntry.score}</p>
              <p className="text-gray-400 mt-2">Rank #{myEntry.rank}</p>
            </div>
          )}
          <div className="space-y-2">
            {podium.map((entry, i) => (
              <div
                key={entry.player_id}
                className={`rounded-xl px-5 py-3 flex items-center justify-between ${
                  entry.player_id === playerId ? "bg-indigo-900/50 border border-indigo-600" : "bg-gray-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{medals[i] ?? `#${entry.rank}`}</span>
                  <span className="font-medium">{entry.name}</span>
                  {entry.player_id === playerId && (
                    <span className="text-xs text-indigo-400">(you)</span>
                  )}
                </div>
                <span className="font-bold text-indigo-300">{entry.score}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-sm">
            Want to play again?{" "}
            <a href="/join" className="text-indigo-400 hover:text-indigo-300 transition">
              Join a new game
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Leaderboard
  if (phase === "leaderboard") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5">
          <h2 className="text-2xl font-bold text-center">Leaderboard</h2>
          <LeaderboardDisplay entries={leaderboard} prevEntries={prevLeaderboard} highlightPlayerId={playerId} />
          <p className="text-gray-600 text-sm text-center">Waiting for host…</p>
        </div>
      </div>
    );
  }

  // Reveal
  if (phase === "reveal" && currentQuestion && revealPayload) {
    const myScore = revealPayload.scores[playerId];
    const isCorrect = myScore?.is_correct ?? false;
    const points = myScore?.points ?? 0;

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div
            className={`rounded-2xl p-8 ${
              isCorrect ? "bg-green-900/40 border border-green-600" : "bg-red-900/40 border border-red-700"
            }`}
          >
            <div className="text-5xl mb-3">{isCorrect ? "✓" : "✗"}</div>
            <p className="text-xl font-bold">{isCorrect ? "Correct!" : "Incorrect"}</p>
            {isCorrect && (
              <p className="text-3xl font-black text-green-400 mt-2">+{points}</p>
            )}
          </div>

          <div className="space-y-2">
            {currentQuestion.question.options.map((opt, i) => {
              const isCorrectOpt = opt.id === revealPayload.correct_option_id;
              const wasSelected = opt.id === selectedOptionId;
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl px-4 py-3 flex items-center gap-3 text-left text-sm font-medium ${
                    isCorrectOpt
                      ? "bg-green-700"
                      : wasSelected
                      ? "bg-red-800 opacity-70"
                      : "bg-gray-800 opacity-40"
                  }`}
                >
                  <span className="opacity-60">{OPTION_SHAPES[i % 4]}</span>
                  <span className="flex-1">{opt.text}</span>
                  {isCorrectOpt && <span className="font-black">✓</span>}
                </div>
              );
            })}
          </div>

          <p className="text-gray-500 text-sm">Leaderboard incoming…</p>
        </div>
      </div>
    );
  }

  // Question phase
  if (phase === "question" && currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{
              width: `${((currentQuestion.question_index + 1) / currentQuestion.total_questions) * 100}%`,
            }}
          />
        </div>

        <div className="flex-1 flex flex-col items-center px-4 py-6 max-w-lg mx-auto w-full">
          {/* Timer + question count */}
          <div className="flex items-center justify-between w-full mb-4">
            <span className="text-gray-400 text-sm">
              {currentQuestion.question_index + 1} / {currentQuestion.total_questions}
            </span>
            <CountdownRing
              timeLimit={currentQuestion.question.time_limit}
              startedAt={questionStartedAt}
            />
            <div className="w-16" />
          </div>

          {/* Question text */}
          <div className="w-full bg-gray-900 rounded-2xl p-6 text-center mb-6 flex-shrink-0">
            <p className="text-lg font-bold leading-snug">
              {currentQuestion.question.text}
            </p>
          </div>

          {/* Options */}
          <div className="w-full grid grid-cols-2 gap-3 flex-1">
            {currentQuestion.question.options.map((opt, i) => {
              const colors = OPTION_COLORS[i % 4];
              const isSelected = selectedOptionId === opt.id;
              const isLocked = !!selectedOptionId;
              return (
                <button
                  key={opt.id}
                  onClick={() =>
                    handleSelectOption(opt.id, currentQuestion.question.id)
                  }
                  disabled={isLocked}
                  className={`
                    ${colors.bg} ${!isLocked ? colors.hover : ""}
                    ${isSelected ? colors.selected : ""}
                    ${isLocked && !isSelected ? "opacity-50" : ""}
                    rounded-xl p-4 flex flex-col items-center justify-center gap-2
                    text-white font-semibold text-sm text-center
                    transition-all disabled:cursor-not-allowed min-h-[80px]
                  `}
                >
                  <span className="text-2xl font-black opacity-70">{OPTION_SHAPES[i % 4]}</span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {selectedOptionId && (
            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm">Answer locked in! Waiting for others…</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
