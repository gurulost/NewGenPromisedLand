import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BugReportDialog } from "../client/src/components/ui/BugReportDialog";

describe("BugReportDialog", () => {
  it("requires a detailed message before submit", async () => {
    render(
      <BugReportDialog
        open
        onOpenChange={vi.fn()}
        initialSource="desktop_corner"
        initialCategory="gameplay"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Send report/i })).toBeDisabled();
  });

  it("submits the filled draft and shows the success state", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      queued: false,
      submissionId: "submission-1",
      response: {
        reportId: "BR-000101",
        duplicateCount24h: 1,
        fingerprint: "abc123",
        receivedAt: new Date().toISOString(),
      },
    });

    render(
      <BugReportDialog
        open
        onOpenChange={vi.fn()}
        initialSource="desktop_corner"
        initialCategory="ui"
        onSubmit={onSubmit}
      />,
    );

    await user.type(
      screen.getByLabelText(/What happened\?/i),
      "The diplomacy panel stopped responding after I opened it twice in a row.",
    );
    await user.type(
      screen.getByLabelText(/Contact/i),
      "tester@example.com",
    );
    await user.click(screen.getByRole("button", { name: /Send report/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        source: "desktop_corner",
        category: "ui",
        contact: "tester@example.com",
      }));
    });
    expect(await screen.findByText(/Saved as BR-000101/i)).toBeInTheDocument();
  });
});
