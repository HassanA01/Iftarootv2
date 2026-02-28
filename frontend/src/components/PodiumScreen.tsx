import { useMemo } from "react";
import type { PodiumEntry } from "../types";

interface Props {
  entries: PodiumEntry[];
  /** When provided, highlights this player in the results list. */
  playerId?: string;
  /** Called when the primary action button is clicked (host only). */
  onEnd?: () => void;
  /** Label for the primary action button. */
  endLabel?: string;
}

// Deterministic confetti piece config so SSR/test renders are stable.
const CONFETTI_COLORS = [
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
];

interface ConfettiPiece {
  id: number;
  color: string;
  left: string;
  delay: string;
  duration: string;
  width: string;
  height: string;
  rotate: string;
}

function generateConfetti(count: number): ConfettiPiece[] {
  // Simple LCG so results are deterministic (no Math.random drift between renders).
  let seed = 42;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return ((seed >>> 0) / 0xffffffff) % 1;
  };

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)],
    left: `${rng() * 100}%`,
    delay: `${rng() * 3}s`,
    duration: `${2.5 + rng() * 2}s`,
    width: `${6 + Math.floor(rng() * 8)}px`,
    height: `${10 + Math.floor(rng() * 8)}px`,
    rotate: `${Math.floor(rng() * 360)}deg`,
  }));
}

// podium order: 2nd (left), 1st (center, tallest), 3rd (right)
const PODIUM_ORDER = [1, 0, 2] as const; // indices into top3
const PODIUM_HEIGHTS = ["h-24", "h-36", "h-16"]; // 2nd, 1st, 3rd
const PODIUM_COLORS = [
  "bg-gray-400 text-gray-900", // 2nd — silver
  "bg-yellow-400 text-yellow-900", // 1st — gold
  "bg-amber-700 text-amber-100", // 3rd — bronze
];
const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_LABELS = ["2nd", "1st", "3rd"];

export function PodiumScreen({ entries, playerId, onEnd, endLabel = "Back to Dashboard" }: Props) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const confetti = useMemo(() => generateConfetti(80), []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 overflow-hidden relative">
      {/* Confetti */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((piece) => (
          <div
            key={piece.id}
            className="absolute top-0 animate-confetti-fall opacity-90"
            style={{
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              width: piece.width,
              height: piece.height,
            }}
          >
            <div
              className="w-full h-full animate-confetti-spin"
              style={{
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate})`,
                animationDelay: piece.delay,
              }}
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">
        <h1 className="text-4xl font-black tracking-tight text-center">
          🎉 Game Over!
        </h1>

        {/* Classic podium visual */}
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-3 w-full px-2">
            {PODIUM_ORDER.map((entryIdx, podiumSlot) => {
              const entry = top3[entryIdx];
              if (!entry) return <div key={podiumSlot} className="flex-1" />;
              const isSelf = entry.player_id === playerId;
              return (
                <div
                  key={entry.player_id}
                  className="flex-1 flex flex-col items-center"
                  data-testid={`podium-slot-${RANK_LABELS[podiumSlot].toLowerCase()}`}
                >
                  {/* Player avatar / medal */}
                  <div className="flex flex-col items-center mb-2 gap-1">
                    <span className="text-3xl">{MEDALS[entryIdx]}</span>
                    <span
                      className={`text-xs font-bold text-center leading-tight max-w-[80px] truncate ${
                        isSelf ? "text-indigo-300" : "text-white"
                      }`}
                      title={entry.name}
                    >
                      {entry.name}
                      {isSelf && " (you)"}
                    </span>
                    <span className="text-xs font-black text-indigo-300 tabular-nums">
                      {entry.score}
                    </span>
                  </div>
                  {/* Podium block */}
                  <div
                    className={`${PODIUM_HEIGHTS[podiumSlot]} ${PODIUM_COLORS[podiumSlot]} w-full rounded-t-lg flex items-center justify-center`}
                  >
                    <span className="font-black text-lg">{RANK_LABELS[podiumSlot]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* My score card (player view) */}
        {playerId && (() => {
          const myEntry = entries.find((e) => e.player_id === playerId);
          if (!myEntry || myEntry.rank <= 3) return null;
          return (
            <div className="w-full bg-indigo-900/40 border border-indigo-700 rounded-2xl p-5 text-center">
              <p className="text-gray-400 text-sm mb-1">Your final score</p>
              <p className="text-4xl font-black text-indigo-300">{myEntry.score}</p>
              <p className="text-gray-400 mt-2">Rank #{myEntry.rank}</p>
            </div>
          );
        })()}

        {/* Remaining players (4th+) */}
        {rest.length > 0 && (
          <div className="w-full space-y-2">
            {rest.map((entry) => {
              const isSelf = entry.player_id === playerId;
              return (
                <div
                  key={entry.player_id}
                  className={`rounded-xl px-5 py-3 flex items-center justify-between ${
                    isSelf
                      ? "bg-indigo-900/50 border border-indigo-600"
                      : "bg-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-bold text-gray-400">
                      #{entry.rank}
                    </span>
                    <span className="font-medium">
                      {entry.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-indigo-400">(you)</span>
                      )}
                    </span>
                  </div>
                  <span className="font-bold text-indigo-300 tabular-nums">
                    {entry.score}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        {onEnd ? (
          <button
            onClick={onEnd}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition text-lg"
          >
            {endLabel}
          </button>
        ) : (
          <p className="text-gray-500 text-sm">
            Want to play again?{" "}
            <a
              href="/join"
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              Join a new game
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
