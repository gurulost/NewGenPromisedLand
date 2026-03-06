import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AnimationLabGate from "../client/src/components/ui/AnimationLabGate";

type MockState = {
  allowed: boolean;
  loading: boolean;
  initialized: boolean;
  configured: boolean;
  question: string;
  error: string | null;
  expiresAt: string | null;
  refresh: ReturnType<typeof vi.fn>;
  unlock: ReturnType<typeof vi.fn>;
};

const mockState = vi.hoisted<MockState>(() => ({
  allowed: false,
  loading: false,
  initialized: true,
  configured: true,
  question: "Who was the queen of all cats, born in a garage?",
  error: null,
  expiresAt: null,
  refresh: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../client/src/lib/stores/useAnimationLabAccess", () => ({
  useAnimationLabAccess: (selector: (state: MockState) => unknown) => selector(mockState),
}));

vi.mock("../client/src/components/ui/HeroBackground", () => ({
  HeroBackground: () => <div data-testid="hero-background" />,
}));

describe("AnimationLabGate", () => {
  beforeEach(() => {
    mockState.allowed = false;
    mockState.loading = false;
    mockState.initialized = true;
    mockState.configured = true;
    mockState.question = "Who was the queen of all cats, born in a garage?";
    mockState.error = null;
    mockState.expiresAt = null;
    mockState.refresh.mockReset();
    mockState.refresh.mockResolvedValue(undefined);
    mockState.unlock.mockReset();
    mockState.unlock.mockResolvedValue({ success: true });
  });

  it("shows the unlock question when access is locked", () => {
    render(
      <AnimationLabGate>
        <div>Secret Tool</div>
      </AnimationLabGate>,
    );

    expect(screen.getByText("Restricted Tool")).toBeInTheDocument();
    expect(screen.getByText("Who was the queen of all cats, born in a garage?")).toBeInTheDocument();
    expect(screen.queryByText("Secret Tool")).not.toBeInTheDocument();
  });

  it("renders children when access is already allowed", () => {
    mockState.allowed = true;

    render(
      <AnimationLabGate>
        <div>Secret Tool</div>
      </AnimationLabGate>,
    );

    expect(screen.getByText("Secret Tool")).toBeInTheDocument();
    expect(screen.queryByText("Restricted Tool")).not.toBeInTheDocument();
  });

  it("submits the typed answer to the unlock action", async () => {
    const user = userEvent.setup();

    render(
      <AnimationLabGate>
        <div>Secret Tool</div>
      </AnimationLabGate>,
    );

    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: "Muffin" } });
    await user.click(screen.getByRole("button", { name: "Unlock Animation Lab" }));

    expect(mockState.unlock).toHaveBeenCalledWith("Muffin");
  });
});
