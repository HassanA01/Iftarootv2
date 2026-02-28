import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../types";

interface Props {
  entries: LeaderboardEntry[];
  highlightPlayerId?: string;
  maxEntries?: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardDisplay({ entries, highlightPlayerId, maxEntries = 5 }: Props) {
  const [visible, setVisible] = useState(false);

  // Trigger staggered slide-up animation after mount so CSS transitions fire.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(t);
  }, []);

  const shown = entries.slice(0, maxEntries);

  return (
    <div className="space-y-2">
      {shown.map((entry, i) => {
        const isHighlighted = !!highlightPlayerId && entry.player_id === highlightPlayerId;
        const rank = MEDALS[i] ?? `#${entry.rank}`;

        return (
          <div
            key={entry.player_id}
            style={{
              transitionDelay: `${i * 80}ms`,
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}
            className={[
              "rounded-xl px-5 py-3 flex items-center justify-between",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              isHighlighted
                ? "bg-indigo-900/50 border border-indigo-600"
                : "bg-gray-900",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 text-center font-black text-lg shrink-0">{rank}</span>
              <span className="font-medium">{entry.name}</span>
              {isHighlighted && (
                <span className="text-xs text-indigo-400">(you)</span>
              )}
            </div>
            <span className="font-bold text-indigo-300 tabular-nums">{entry.score}</span>
          </div>
        );
      })}
    </div>
  );
}
