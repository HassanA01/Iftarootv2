import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LeaderboardDisplay } from "../components/LeaderboardDisplay";

const entries = [
  { player_id: "p1", name: "Alice", score: 2000, rank: 1 },
  { player_id: "p2", name: "Bob", score: 1500, rank: 2 },
  { player_id: "p3", name: "Carol", score: 1000, rank: 3 },
  { player_id: "p4", name: "Dave", score: 500, rank: 4 },
];

describe("LeaderboardDisplay", () => {
  it("renders all entries", () => {
    render(<LeaderboardDisplay entries={entries} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getByText("Dave")).toBeInTheDocument();
  });

  it("shows medals for top 3", () => {
    render(<LeaderboardDisplay entries={entries} />);
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
    expect(screen.getByText("🥉")).toBeInTheDocument();
  });

  it("shows rank number for positions beyond top 3", () => {
    render(<LeaderboardDisplay entries={entries} />);
    expect(screen.getByText("#4")).toBeInTheDocument();
  });

  it("shows (you) badge for highlighted player", () => {
    render(<LeaderboardDisplay entries={entries} highlightPlayerId="p2" />);
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("does not show (you) badge when no player is highlighted", () => {
    render(<LeaderboardDisplay entries={entries} />);
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("does not show (you) badge when highlighted player is not in entries", () => {
    render(<LeaderboardDisplay entries={entries} highlightPlayerId="p99" />);
    expect(screen.queryByText("(you)")).not.toBeInTheDocument();
  });

  it("limits displayed entries to maxEntries", () => {
    render(<LeaderboardDisplay entries={entries} maxEntries={2} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
    expect(screen.queryByText("Dave")).not.toBeInTheDocument();
  });

  it("defaults to showing up to 5 entries", () => {
    const six = [
      ...entries,
      { player_id: "p5", name: "Eve", score: 200, rank: 5 },
      { player_id: "p6", name: "Frank", score: 100, rank: 6 },
    ];
    render(<LeaderboardDisplay entries={six} />);
    expect(screen.getByText("Eve")).toBeInTheDocument();
    expect(screen.queryByText("Frank")).not.toBeInTheDocument();
  });

  it("displays scores for each entry", () => {
    render(<LeaderboardDisplay entries={entries} />);
    expect(screen.getByText("2000")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders an empty list without crashing", () => {
    render(<LeaderboardDisplay entries={[]} />);
    expect(screen.queryByText("🥇")).not.toBeInTheDocument();
  });
});
