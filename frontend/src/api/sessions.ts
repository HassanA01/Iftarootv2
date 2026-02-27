import { apiClient } from "./client";
import type { GameSession, GamePlayer } from "../types";

export async function createSession(quizId: string): Promise<{ session_id: string; code: string }> {
  const { data } = await apiClient.post<{ session_id: string; code: string }>("/sessions", {
    quiz_id: quizId,
  });
  return data;
}

export async function getSession(sessionId: string): Promise<GameSession> {
  const { data } = await apiClient.get<GameSession>(`/sessions/${sessionId}`);
  return data;
}

export async function getSessionByCode(code: string): Promise<GameSession> {
  const { data } = await apiClient.get<GameSession>(`/sessions/code/${code}`);
  return data;
}

export async function listSessionPlayers(sessionId: string): Promise<GamePlayer[]> {
  const { data } = await apiClient.get<GamePlayer[]>(`/sessions/${sessionId}/players`);
  return data;
}

export async function startSession(sessionId: string): Promise<GameSession> {
  const { data } = await apiClient.post<GameSession>(`/sessions/${sessionId}/start`);
  return data;
}

export interface JoinSessionResponse {
  player_id: string;
  session_id: string;
  code: string;
  name: string;
}

export async function joinSession(code: string, name: string): Promise<JoinSessionResponse> {
  const { data } = await apiClient.post<JoinSessionResponse>("/sessions/join", { code, name });
  return data;
}
