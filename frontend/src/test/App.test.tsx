import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// Smoke test — verifies the test environment works
describe("test environment", () => {
  it("renders a div", () => {
    render(<div data-testid="hello">Hello</div>);
    expect(screen.getByTestId("hello")).toBeInTheDocument();
  });
});
