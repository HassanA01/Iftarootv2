import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../stores/authStore";
import type { Admin } from "../types";

const mockAdmin: Admin = {
  id: "abc-123",
  email: "admin@test.com",
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  useAuthStore.getState().clearAuth();
});

describe("authStore", () => {
  it("starts unauthenticated", () => {
    const { token, admin, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(admin).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("setAuth stores token and admin", () => {
    useAuthStore.getState().setAuth("tok123", mockAdmin);
    const { token, admin, isAuthenticated } = useAuthStore.getState();
    expect(token).toBe("tok123");
    expect(admin).toEqual(mockAdmin);
    expect(isAuthenticated()).toBe(true);
  });

  it("clearAuth resets state", () => {
    useAuthStore.getState().setAuth("tok123", mockAdmin);
    useAuthStore.getState().clearAuth();
    const { token, admin, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(admin).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});
