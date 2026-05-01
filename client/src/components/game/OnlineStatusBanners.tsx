import type { CSSProperties } from "react";

type TurnRecoveryStatus = {
  canForceEndTurn: boolean;
  msUntilEligible: number;
};

type OnlineStatusBannersProps = {
  isMobileUI: boolean;
  mobileTopOverlayStyle?: CSSProperties;
  showHostTransferBanner: boolean;
  isClaimingHost: boolean;
  onClaimHost: () => void;
  showResyncBanner: boolean;
  showTurnRecoveryBanner: boolean;
  turnRecoveryStatus: TurnRecoveryStatus | null;
  turnRecoveryActorName: string;
  turnRecoverySeconds: number;
  isForcingTurnRecovery: boolean;
  onForceTurnRecovery: () => void;
};

export function OnlineStatusBanners({
  isMobileUI,
  mobileTopOverlayStyle,
  showHostTransferBanner,
  isClaimingHost,
  onClaimHost,
  showResyncBanner,
  showTurnRecoveryBanner,
  turnRecoveryStatus,
  turnRecoveryActorName,
  turnRecoverySeconds,
  isForcingTurnRecovery,
  onForceTurnRecovery,
}: OnlineStatusBannersProps) {
  const hasVisibleBanner = showHostTransferBanner || showResyncBanner || (showTurnRecoveryBanner && turnRecoveryStatus);
  if (!hasVisibleBanner) return null;

  return (
    <div
      className={`absolute ${isMobileUI ? "" : "top-4"} left-1/2 z-[var(--z-floating)] flex w-[min(92vw,42rem)] -translate-x-1/2 flex-col items-center gap-2 pointer-events-auto`}
      style={mobileTopOverlayStyle}
    >
      {showHostTransferBanner && (
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-lg border border-amber-400/50 bg-black/80 px-4 py-2 text-center text-amber-100 shadow-lg backdrop-blur-sm">
          <span className="text-sm">Host disconnected. Attempting transfer...</span>
          <button
            onClick={onClaimHost}
            className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            disabled={isClaimingHost}
          >
            {isClaimingHost ? "Claiming..." : "Take Host"}
          </button>
        </div>
      )}
      {showResyncBanner && (
        <div className="flex max-w-full items-center justify-center gap-3 rounded-lg border border-cyan-300/40 bg-black/80 px-4 py-2 text-center text-cyan-50 shadow-lg backdrop-blur-sm">
          <span className="text-sm">Re-syncing match state with the host...</span>
        </div>
      )}
      {showTurnRecoveryBanner && turnRecoveryStatus && (
        <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-lg border border-amber-400/50 bg-black/80 px-4 py-2 text-center text-amber-100 shadow-lg backdrop-blur-sm">
          <span className="text-sm">
            {turnRecoveryActorName} is inactive.
            {turnRecoveryStatus.canForceEndTurn
              ? " You can skip this turn."
              : ` Recovery available in ${turnRecoverySeconds}s.`}
          </span>
          <button
            onClick={onForceTurnRecovery}
            className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
            disabled={!turnRecoveryStatus.canForceEndTurn || isForcingTurnRecovery}
          >
            {isForcingTurnRecovery ? "Skipping..." : "Skip Disconnected Turn"}
          </button>
        </div>
      )}
    </div>
  );
}
