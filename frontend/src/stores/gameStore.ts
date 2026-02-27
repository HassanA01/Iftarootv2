import { create } from "zustand";

interface ActiveSession {
  sessionId: string;
  code: string;
}

interface GameState {
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession) => void;
  clearActiveSession: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),
  clearActiveSession: () => set({ activeSession: null }),
}));
