import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BugReportStartHint from "../client/src/components/ui/BugReportStartHint";
import BugReportSupportCallout from "../client/src/components/ui/BugReportSupportCallout";

const mocks = vi.hoisted(() => ({
  openBugReportDialog: vi.fn(),
  capture: vi.fn(),
  useMobileUI: vi.fn(() => ({ isMobileUI: false })),
}));

vi.mock("../client/src/utils/bugReport", () => ({
  isBugReportingEnabled: () => true,
  openBugReportDialog: mocks.openBugReportDialog,
}));

vi.mock("../client/src/utils/telemetry/posthog", () => ({
  capture: mocks.capture,
}));

vi.mock("../client/src/hooks/useMobileUI", () => ({
  useMobileUI: mocks.useMobileUI,
}));

describe("bug report guidance surfaces", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.openBugReportDialog.mockReset();
    mocks.capture.mockReset();
    mocks.useMobileUI.mockReturnValue({ isMobileUI: false });
  });

  it("opens the report form from the pregame support callout", async () => {
    const user = userEvent.setup();

    render(<BugReportSupportCallout />);

    expect(screen.getAllByText(/Something not working\?/)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Open report form" }));

    expect(mocks.openBugReportDialog).toHaveBeenCalledWith({
      source: "start_flow_hint",
      category: "ui",
    });
    expect(mocks.capture).toHaveBeenCalledWith("bug_report_guidance_cta_clicked", {
      surface: "start_flow",
      entry: "desktop",
    });
  });

  it("switches the start-flow guidance copy for mobile", () => {
    mocks.useMobileUI.mockReturnValue({ isMobileUI: true });

    render(<BugReportSupportCallout />);

    expect(screen.getAllByText(/Menu > Report Issue/)).toHaveLength(2);
  });

  it("shows the in-game hint once per match and re-shows for a new match", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <BugReportStartHint gameId="game-1" turn={1} isMobile={false} />,
    );

    expect(screen.getByTestId("bug-report-start-hint")).toBeInTheDocument();
    expect(mocks.capture).toHaveBeenCalledWith("bug_report_guidance_shown", {
      surface: "in_game",
      entry: "desktop",
    });

    await user.click(screen.getByRole("button", { name: "Noted" }));
    expect(screen.queryByTestId("bug-report-start-hint")).not.toBeInTheDocument();

    rerender(<BugReportStartHint gameId="game-1" turn={1} isMobile={false} />);
    expect(screen.queryByTestId("bug-report-start-hint")).not.toBeInTheDocument();

    rerender(<BugReportStartHint gameId="game-2" turn={1} isMobile={false} />);
    expect(screen.getByTestId("bug-report-start-hint")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Report now" }));
    expect(mocks.openBugReportDialog).toHaveBeenCalledWith({
      source: "in_game_hint",
      category: "gameplay",
    });
  });

  it("hides the in-game hint after the opening turn", () => {
    const { rerender } = render(
      <BugReportStartHint gameId="game-3" turn={1} isMobile={true} />,
    );

    expect(screen.getByTestId("bug-report-start-hint")).toBeInTheDocument();

    rerender(<BugReportStartHint gameId="game-3" turn={2} isMobile={true} />);
    expect(screen.queryByTestId("bug-report-start-hint")).not.toBeInTheDocument();
  });

  it("waits until blocking overlays clear before marking the match hint as seen", () => {
    const { rerender } = render(
      <BugReportStartHint gameId="game-4" turn={1} isMobile={false} blocked={true} />,
    );

    expect(screen.queryByTestId("bug-report-start-hint")).not.toBeInTheDocument();
    expect(localStorage.getItem("ngpl_bug_report_match_hint_seen_v1:game-4")).toBeNull();

    rerender(<BugReportStartHint gameId="game-4" turn={1} isMobile={false} blocked={false} />);

    expect(screen.getByTestId("bug-report-start-hint")).toBeInTheDocument();
    expect(localStorage.getItem("ngpl_bug_report_match_hint_seen_v1:game-4")).toBe("1");
  });

  it("uses the shared mobile HUD offset instead of adding safe-area twice", () => {
    render(<BugReportStartHint gameId="game-5" turn={1} isMobile={true} />);

    expect(screen.getByTestId("bug-report-start-hint")).toHaveStyle({
      top: "calc(var(--mobile-hud-height, 0px) + 0.75rem)",
    });
  });
});
