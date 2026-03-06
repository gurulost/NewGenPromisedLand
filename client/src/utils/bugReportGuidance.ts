const BUG_REPORT_MATCH_HINT_PREFIX = "ngpl_bug_report_match_hint_seen_v1:";

const canUseStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getBugReportMatchHintStorageKey = (gameId: string): string =>
  `${BUG_REPORT_MATCH_HINT_PREFIX}${String(gameId ?? "").trim()}`;

export const hasSeenBugReportMatchHint = (gameId: string): boolean => {
  if (!canUseStorage()) return false;
  const normalizedGameId = String(gameId ?? "").trim();
  if (!normalizedGameId) return false;
  try {
    return window.localStorage.getItem(getBugReportMatchHintStorageKey(normalizedGameId)) === "1";
  } catch {
    return false;
  }
};

export const markBugReportMatchHintSeen = (gameId: string): void => {
  if (!canUseStorage()) return;
  const normalizedGameId = String(gameId ?? "").trim();
  if (!normalizedGameId) return;
  try {
    window.localStorage.setItem(getBugReportMatchHintStorageKey(normalizedGameId), "1");
  } catch {
    // Ignore storage failures.
  }
};

export const clearBugReportMatchHintSeen = (gameId: string): void => {
  if (!canUseStorage()) return;
  const normalizedGameId = String(gameId ?? "").trim();
  if (!normalizedGameId) return;
  try {
    window.localStorage.removeItem(getBugReportMatchHintStorageKey(normalizedGameId));
  } catch {
    // Ignore storage failures.
  }
};

export const shouldShowBugReportMatchHint = (params: {
  enabled: boolean;
  gameId: string | null | undefined;
  turn: number | null | undefined;
}): boolean => {
  if (!params.enabled) return false;
  const normalizedGameId = String(params.gameId ?? "").trim();
  if (!normalizedGameId) return false;
  if (params.turn !== 1) return false;
  return !hasSeenBugReportMatchHint(normalizedGameId);
};

export const getBugReportEntryLabel = (isMobile: boolean): string =>
  isMobile ? "Menu > Report Issue" : '"Something not working?"';

export const getPregameBugReportGuidance = (isMobile: boolean): string =>
  isMobile
    ? "If this screen misbehaves, report it here. Once the match starts, open Menu > Report Issue so the report can attach the board, recent actions, and recent errors automatically."
    : 'If this screen misbehaves, report it here. Once the match starts, use "Something not working?" so the report can attach the board, recent actions, and recent errors automatically.';

export const getInGameBugReportGuidance = (isMobile: boolean): string =>
  isMobile
    ? "Open Menu > Report Issue. The report can attach this board, recent actions, and recent errors automatically."
    : 'Use "Something not working?" in the lower-right. The report can attach this board, recent actions, and recent errors automatically.';
