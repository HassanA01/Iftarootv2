import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import type { WsMessage } from "../types";

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:8081";

interface PlayerInfo {
  id: string;
  name: string;
}

export function PlayerLobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const playerId = sessionStorage.getItem("player_id") ?? "";
  const playerName = sessionStorage.getItem("player_name") ?? "";

  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [wsReady, setWsReady] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  // Redirect if no identity (e.g. page refresh)
  useEffect(() => {
    if (!playerId || !playerName) {
      navigate(`/join?code=${code}`, { replace: true });
    }
  }, [playerId, playerName, code, navigate]);

  const handleMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "player_joined") {
      const payload = msg.payload as { player_id: string; name: string };
      setPlayers((prev) => {
        if (prev.some((p) => p.id === payload.player_id)) return prev;
        return [...prev, { id: payload.player_id, name: payload.name }];
      });
    } else if (msg.type === "player_left") {
      const payload = msg.payload as { player_id: string };
      setPlayers((prev) => prev.filter((p) => p.id !== payload.player_id));
    } else if (msg.type === "game_started") {
      navigate(`/game/${code}/play`);
    }
  }, [code, navigate]);

  const wsUrl = `${WS_BASE}/api/v1/ws/player/${code}?player_id=${playerId}&name=${encodeURIComponent(playerName)}`;

  useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onOpen: () => {
      setWsReady(true);
      setDisconnected(false);
    },
    onClose: () => {
      setWsReady(false);
      setDisconnected(true);
    },
    enabled: !!playerId && !!code,
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Status */}
        <div>
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-black mx-auto mb-4">
            {playerName ? playerName[0].toUpperCase() : "?"}
          </div>
          <h1 className="text-2xl font-bold">{playerName}</h1>
          <p className="text-gray-400 text-sm mt-1">Room {code}</p>
        </div>

        {disconnected ? (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
            <p className="text-red-400 text-sm">Disconnected. Reconnecting…</p>
          </div>
        ) : wsReady ? (
          <div className="bg-gray-900 rounded-xl p-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-gray-300 font-medium">Waiting for host to start…</p>
            </div>

            {players.length > 0 && (
              <div className="mt-4 text-left">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                  In the room ({players.length})
                </p>
                <ul className="space-y-1">
                  {players.map((p) => (
                    <li key={p.id} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold">
                        {p.name[0].toUpperCase()}
                      </span>
                      {p.name}
                      {p.id === playerId && (
                        <span className="text-xs text-indigo-400">(you)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-6">
            <p className="text-gray-400 text-sm">Connecting…</p>
          </div>
        )}
      </div>
    </div>
  );
}
