import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { JoinPage } from "../pages/JoinPage";

vi.mock("../api/sessions", () => ({
  joinSession: vi.fn(),
}));

function renderJoinPage(initialEntries = ["/join"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <JoinPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("JoinPage", () => {
  it("renders code and name inputs", () => {
    renderJoinPage();
    expect(screen.getByLabelText(/room code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it("pre-fills code from query param", () => {
    renderJoinPage(["/join?code=123456"]);
    expect(screen.getByLabelText(/room code/i)).toHaveValue("123456");
  });

  it("disables submit until code is 6 digits and name is filled", async () => {
    renderJoinPage();
    const btn = screen.getByRole("button", { name: /join game/i });
    expect(btn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/room code/i), "123456");
    expect(btn).toBeDisabled(); // still no name

    await userEvent.type(screen.getByLabelText(/your name/i), "Alice");
    expect(btn).not.toBeDisabled();
  });

  it("only allows digits in the code field", async () => {
    renderJoinPage();
    const codeInput = screen.getByLabelText(/room code/i);
    await userEvent.type(codeInput, "abc123def");
    expect(codeInput).toHaveValue("123");
  });
});
