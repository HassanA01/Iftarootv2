import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the auth store before importing apiClient
const mockClearAuth = vi.fn();
vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      token: null,
      clearAuth: mockClearAuth,
    }),
  },
}));

// Capture window.location.href assignments
let locationHref = "";
Object.defineProperty(window, "location", {
  value: {
    get href() {
      return locationHref;
    },
    set href(v: string) {
      locationHref = v;
    },
  },
  writable: true,
});

type InterceptorHandler = {
  rejected: (err: unknown) => Promise<unknown>;
} | null;

function getInterceptor(apiClient: {
  interceptors: { response: { handlers: InterceptorHandler[] } };
}) {
  const handler = apiClient.interceptors.response.handlers.find(
    (h) => h !== null
  );
  if (!handler) throw new Error("No interceptor found");
  return handler.rejected;
}

describe("apiClient 401 interceptor", () => {
  beforeEach(() => {
    mockClearAuth.mockClear();
    locationHref = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears auth and redirects to /login on 401 from a non-auth endpoint", async () => {
    const { apiClient } = await import("../api/client");
    const rejected = getInterceptor(
      apiClient as Parameters<typeof getInterceptor>[0]
    );

    const err = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
      config: { url: "/quizzes" },
    });

    await rejected(err).catch(() => {});

    expect(mockClearAuth).toHaveBeenCalledOnce();
    expect(locationHref).toBe("/login");
  });

  it("does NOT redirect on 401 from /auth/login", async () => {
    const { apiClient } = await import("../api/client");
    const rejected = getInterceptor(
      apiClient as Parameters<typeof getInterceptor>[0]
    );

    const err = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
      config: { url: "/auth/login" },
    });

    await rejected(err).catch(() => {});

    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(locationHref).toBe("");
  });

  it("does NOT redirect on 401 from /auth/register", async () => {
    const { apiClient } = await import("../api/client");
    const rejected = getInterceptor(
      apiClient as Parameters<typeof getInterceptor>[0]
    );

    const err = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
      config: { url: "/auth/register" },
    });

    await rejected(err).catch(() => {});

    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(locationHref).toBe("");
  });

  it("still rejects the promise on 401 so callers can handle the error", async () => {
    const { apiClient } = await import("../api/client");
    const rejected = getInterceptor(
      apiClient as Parameters<typeof getInterceptor>[0]
    );

    const err = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
      config: { url: "/auth/login" },
    });

    await expect(rejected(err)).rejects.toThrow("Unauthorized");
  });
});
