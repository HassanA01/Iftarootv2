import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getSessionByCode, listSessionPlayers, startSession } from "../api/sessions";
import { useWebSocket } from "../hooks/useWebSocket";
import type { WsMessage, GamePlayer } from "../types";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8081";

interface WsPlayerEvent {
  type: "joined" | "left";
  player_id: string;
  name: string;
}

export function HostLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [wsReady, setWsReady] = useState(false);
  const [wsEvents, setWsEvents] = useState<WsPlayerEvent[]>([]);

  const { data: session, isError } = useQuery({
    queryKey: ["session-by-code", code],
    queryFn: () => getSessionByCode(code!),
    enabled: !!code,
  });

  const { data: initialPlayers } = useQuery({
    queryKey: ["session-players", session?.id],
    queryFn: () => listSessionPlayers(session!.id),
    enabled: !!session?.id,
  });

  // Derive player list from initial DB snapshot merged with live WS events.
  const players: GamePlayer[] = useMemo(() => {
    let result = [...(initialPlayers ?? [])];
    for (const ev of wsEvents) {
      if (ev.type === "joined" && !result.some((p) => p.id === ev.player_id)) {
        result.push({
          id: ev.player_id,
          session_id: session?.id ?? "",
          name: ev.name,
          score: 0,
          joined_at: new Date().toISOString(),
        });
      } else if (ev.type === "left") {
        result = result.filter((p) => p.id !== ev.player_id);
      }
    }
    return result;
  }, [initialPlayers, wsEvents, session?.id]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "player_joined") {
        const payload = msg.payload as { player_id: string; name: string };
        setWsEvents((prev) => [
          ...prev,
          { type: "joined", player_id: payload.player_id, name: payload.name },
        ]);
      } else if (msg.type === "player_left") {
        const payload = msg.payload as { player_id: string };
        setWsEvents((prev) => [...prev, { type: "left", player_id: payload.player_id, name: "" }]);
      } else if (msg.type === "game_started") {
        navigate(`/admin/game/${code}`);
      }
    },
    [code, navigate],
  );

  useWebSocket({
    url: `${WS_BASE}/api/v1/ws/host/${code}`,
    onMessage: handleMessage,
    onOpen: () => setWsReady(true),
    onClose: () => setWsReady(false),
    enabled: !!code && !!session,
  });

  const startMutation = useMutation({
    mutationFn: () => startSession(session!.id),
  });

  const joinUrl = `${window.location.origin}/join?code=${code}`;

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-red-400">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Room code</p>
          <h1 className="text-7xl font-black tracking-widest text-indigo-400">{code}</h1>
          <p className="text-gray-500 text-sm mt-2">
            {wsReady ? (
              <span className="text-green-400">● Connected</span>
            ) : (
              <span className="text-yellow-400">● Connecting…</span>
            )}
          </p>
        </div>

        {/* Join URL */}
        <div className="bg-gray-900 rounded-xl p-5 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Join at</p>
          <p className="text-indigo-300 font-mono text-sm break-all">{joinUrl}</p>
        </div>

        {/* Player list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Players{" "}
              <span className="text-gray-400 font-normal text-base">({players.length})</span>
            </h2>
          </div>

          {players.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
              <p>Waiting for players to join…</p>
            </div>
          ) : (
            <ul className="bg-gray-900 rounded-xl divide-y divide-gray-800">
              {players.map((player) => (
                <li key={player.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                    {player.name[0].toUpperCase()}
                  </span>
                  <span className="font-medium">{player.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={() => startMutation.mutate()}
          disabled={players.length === 0 || startMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition"
        >
          {startMutation.isPending ? "Starting…" : "Start Game"}
        </button>

        {startMutation.isError && (
          <p className="text-red-400 text-center text-sm">Failed to start game. Try again.</p>
        )}
      </div>
    </div>
  );
}
