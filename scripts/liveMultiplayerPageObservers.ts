import type { Page } from "playwright";

type Severity = "low" | "medium" | "high" | "blocker";

export type LiveMultiplayerObservedAgent = {
  name: string;
  page: Page;
  consoleMessages: Array<{ type: string; text: string }>;
  failedRequests: Array<{ url: string; errorText?: string }>;
  httpErrors: Array<{ url: string; status: number; statusText: string }>;
  ignoredRequests: Array<{ url: string; errorText?: string; status?: number; reason: string }>;
  isClosing: boolean;
  networkSuppressionReason?: string | null;
};

function shouldIgnoreFailedRequest(url: string, errorText?: string): string | null {
  if (errorText === "net::ERR_ABORTED" && /\.(avif|webm|png|jpe?g|gif|svg)(?:[?#].*)?$/i.test(url)) {
    return "canceled_media_navigation_request";
  }
  if (errorText === "net::ERR_ABORTED" && /\/sounds\/[^/?]+\.(mp3|wav|ogg)(?:[?#].*)?$/i.test(url)) {
    return "canceled_audio_navigation_request";
  }
  if (errorText === "net::ERR_ABORTED" && /\/api\/lobbies\/[^/?]+\/realtime(?:[?#].*)?$/i.test(url)) {
    return "closed_realtime_stream";
  }
  if (url.includes("posthog") || url.includes("analytics")) return "analytics_request";
  return null;
}

function shouldIgnoreHttpError(url: string, status: number): string | null {
  if (status === 409 && /\/api\/lobbies\/[^/?]+\/players\/heartbeat(?:[?#].*)?$/i.test(url)) {
    return "transient_player_heartbeat_conflict";
  }
  if (status === 409 && /\/api\/lobbies\/[^/?]+\/chat\/read(?:[?#].*)?$/i.test(url)) {
    return "transient_chat_read_conflict";
  }
  return null;
}

function shouldIgnoreConsoleError(text: string): string | null {
  if (/Failed to load saved games: SaveApiError: Cloud save service (?:is unavailable|returned an invalid response)/i.test(text)) {
    return "expected_cloud_save_unavailable";
  }
  return null;
}

export function createLiveMultiplayerPageObservers({
  baseUrl,
  addIssue,
}: {
  baseUrl: string;
  addIssue: (severity: Severity, title: string, detail?: Record<string, unknown>) => void;
}) {
  const isSameOriginUrl = (url: string): boolean => {
    try {
      return new URL(url).origin === new URL(baseUrl).origin;
    } catch {
      return false;
    }
  };

  return {
    attachPageObservers(agent: LiveMultiplayerObservedAgent) {
      agent.page.on("console", (message) => {
        const text = message.text();
        agent.consoleMessages.push({ type: message.type(), text });
        if (message.type() !== "error") return;
        if (/Failed to load resource: the server responded with a status of \d+/i.test(text)) return;
        if (shouldIgnoreConsoleError(text)) return;
        addIssue("medium", "Browser console error", { agent: agent.name, text });
      });
      agent.page.on("pageerror", (error) => {
        addIssue("high", "Browser page error", { agent: agent.name, error: String(error) });
      });
      agent.page.on("requestfailed", (request) => {
        const url = request.url();
        const failure = request.failure();
        if (agent.isClosing) return;
        if (agent.networkSuppressionReason) {
          agent.ignoredRequests.push({ url, errorText: failure?.errorText, reason: agent.networkSuppressionReason });
          return;
        }
        const ignoredReason = shouldIgnoreFailedRequest(url, failure?.errorText);
        if (ignoredReason) {
          agent.ignoredRequests.push({ url, errorText: failure?.errorText, reason: ignoredReason });
          return;
        }
        agent.failedRequests.push({ url, errorText: failure?.errorText });
        addIssue("medium", "Browser request failed", { agent: agent.name, url, errorText: failure?.errorText });
      });
      agent.page.on("response", (response) => {
        const status = response.status();
        if (agent.isClosing || status < 400 || !isSameOriginUrl(response.url())) return;
        const entry = { url: response.url(), status, statusText: response.statusText() };
        const ignoredReason = shouldIgnoreHttpError(entry.url, status);
        if (ignoredReason) {
          agent.ignoredRequests.push({ url: entry.url, status, reason: ignoredReason });
          return;
        }
        agent.httpErrors.push(entry);
        addIssue("medium", "Browser HTTP error response", { agent: agent.name, ...entry });
      });
    },
  };
}
