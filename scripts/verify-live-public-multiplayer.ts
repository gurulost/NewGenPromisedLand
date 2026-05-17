import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

import { buildMultiplayerVersionHeaders } from "../shared/multiplayerVersion";

type Severity = "low" | "medium" | "high" | "blocker";

type Issue = {
  severity: Severity;
  title: string;
  detail?: Record<string, unknown>;
  at: string;
};

type SmokeAgent = {
  name: string;
  username: string;
  password: string;
  faction: string;
  seatIndex: number;
  context: BrowserContext;
  page: Page;
  userId?: number;
  playerId?: string;
  consoleMessages: Array<{ type: string; text: string }>;
  failedRequests: Array<{ url: string; errorText?: string }>;
  httpErrors: Array<{ url: string; status: number; statusText: string }>;
  ignoredRequests: Array<{ url: string; errorText?: string; reason: string }>;
  isClosing: boolean;
};

const args = process.argv.slice(2);

function readArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1] ?? fallback;
  return fallback;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function readIntArg(name: string, fallback: number): number {
  const raw = readArg(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : fallback;
}

const BASE_URL = (readArg("base-url", process.env.COVENANT_BASE_URL) ?? "https://covenantlegends.com")
  .replace(/\/+$/, "");
const PLAYER_COUNT = Math.min(Math.max(readIntArg("players", 3), 2), 8);
const ROUND_COUNT = Math.max(readIntArg("rounds", 4), 1);
const BUILD_ID = readArg("build-id", process.env.COVENANT_BUILD_ID);
const HEADLESS = !hasFlag("headed");
const KEEP_LOBBY = hasFlag("keep-lobby");
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const OUTPUT_DIR = path.resolve("output/live-multiplayer-smoke", `${RUN_ID}-${randomUUID().slice(0, 8)}`);
const VERSION_HEADERS = buildMultiplayerVersionHeaders(BUILD_ID);
const JSON_HEADERS = {
  ...VERSION_HEADERS,
  "Content-Type": "application/json",
};
const FACTIONS = [
  "NEPHITES",
  "LAMANITES",
  "MULEKITES",
  "ANTI_NEPHI_LEHIES",
  "ZORAMITES",
  "JAREDITES",
  "HAGOTH_MARINERS",
  "AMULONITES",
];

const issues: Issue[] = [];
const events: Array<Record<string, unknown>> = [];
const screenshots: string[] = [];
const finalStates: Array<Record<string, unknown>> = [];
const password = `CodexSmoke-${RUN_ID}-${randomUUID().slice(0, 10)}`;
const REQUIRED_DEPLOYED_MARKERS = [
  "lobby-join-code-input",
  "lobby-room",
  "lobby-authority-notice",
  "lobby-start-game",
  "data-seat-state",
  "Public unranked multiplayer is server-authoritative.",
] as const;

let lobbyCode: string | null = null;
let lobbyId: number | null = null;
let lobbyName: string | null = null;
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
const agents: SmokeAgent[] = [];

function logEvent(type: string, detail: Record<string, unknown> = {}) {
  const entry = { at: new Date().toISOString(), type, ...detail };
  events.push(entry);
  console.log(JSON.stringify(entry));
}

function addIssue(severity: Severity, title: string, detail: Record<string, unknown> = {}) {
  const issue = { severity, title, detail, at: new Date().toISOString() };
  issues.push(issue);
  console.error(JSON.stringify({ type: "issue", ...issue }));
}

function summarizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 1200);
}

function isFatalIssue(issue: Issue): boolean {
  return issue.severity === "blocker" || issue.severity === "high";
}

function shouldIgnoreFailedRequest(url: string, errorText?: string): string | null {
  if (errorText === "net::ERR_ABORTED" && /\/sounds\/[^/?]+\.(mp3|wav|ogg)(?:[?#].*)?$/i.test(url)) {
    return "canceled_audio_navigation_request";
  }
  if (url.includes("posthog") || url.includes("analytics")) {
    return "analytics_request";
  }
  return null;
}

function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url).origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

async function waitFor<T>(
  label: string,
  fn: () => Promise<T | false | null | undefined>,
  timeoutMs = 30_000,
  intervalMs = 500,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`${label} timed out${lastError ? `: ${String(lastError)}` : ""}`);
}

async function api(
  agent: SmokeAgent,
  method: string,
  requestPath: string,
  data?: unknown,
  headers: Record<string, string> = JSON_HEADERS,
) {
  const options: Parameters<typeof agent.context.request.fetch>[1] = {
    method,
    headers,
    failOnStatusCode: false,
  };
  if (data !== undefined) {
    options.data = data;
  }
  const response = await agent.context.request.fetch(`${BASE_URL}${requestPath}`, options);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, status: response.status(), ok: response.ok(), body, text };
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const response = await fetch(url);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

function resolveAssetUrl(src: string): string {
  return new URL(src, `${BASE_URL}/`).toString();
}

async function preflightDeployedBundle() {
  const home = await fetchText(`${BASE_URL}/`);
  if (!home.ok) {
    addIssue("blocker", "Could not fetch live app shell", {
      status: home.status,
      baseUrl: BASE_URL,
    });
    throw new Error(`live app shell fetch failed (${home.status})`);
  }

  const scriptSrcs = Array.from(home.text.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi))
    .map((match) => match[1])
    .filter((src) => src.includes("/assets/"));

  if (scriptSrcs.length === 0) {
    addIssue("blocker", "Live app shell does not reference a bundled asset", {
      baseUrl: BASE_URL,
      htmlPreview: summarizeText(home.text),
    });
    throw new Error("missing deployed app bundle");
  }

  const bundleChecks = [];
  for (const scriptSrc of scriptSrcs) {
    const assetUrl = resolveAssetUrl(scriptSrc);
    const asset = await fetchText(assetUrl);
    if (!asset.ok) {
      bundleChecks.push({ assetUrl, status: asset.status, missingMarkers: [...REQUIRED_DEPLOYED_MARKERS] });
      continue;
    }
    const missingMarkers = REQUIRED_DEPLOYED_MARKERS.filter((marker) => !asset.text.includes(marker));
    bundleChecks.push({
      assetUrl,
      status: asset.status,
      byteLength: asset.text.length,
      missingMarkers,
    });
    if (missingMarkers.length === 0) {
      logEvent("deployed_bundle_preflight_passed", {
        assetUrl,
        byteLength: asset.text.length,
      });
      return;
    }
  }

  addIssue("blocker", "Live deployment is missing the latest multiplayer smoke hooks", {
    requiredMarkers: [...REQUIRED_DEPLOYED_MARKERS],
    bundleChecks,
  });
  throw new Error("live deployment is missing latest multiplayer smoke hooks");
}

async function capturePage(agent: SmokeAgent, label: string) {
  const file = path.join(OUTPUT_DIR, `${agent.name}-${label}.png`);
  try {
    await agent.page.screenshot({ path: file, fullPage: true });
    screenshots.push(file);
  } catch (error) {
    addIssue("medium", "Screenshot capture failed", { agent: agent.name, label, error: String(error) });
  }
}

async function assertPageNotBlank(agent: SmokeAgent, label: string) {
  const state = await agent.page
    .evaluate(() => ({
      url: location.href,
      text: document.body.innerText,
      htmlLength: document.body.innerHTML.length,
    }))
    .catch((error) => ({ error: String(error), text: "", htmlLength: 0, url: "" }));

  if ("error" in state) {
    addIssue("high", "Browser page evaluation failed", { agent: agent.name, label, error: state.error });
    return;
  }
  if (summarizeText(state.text).length < 20 || state.htmlLength < 200) {
    addIssue("high", "Browser page appears blank", {
      agent: agent.name,
      label,
      url: state.url,
      text: summarizeText(state.text),
      htmlLength: state.htmlLength,
    });
  }
}

async function clickIfVisible(page: Page, testId: string, timeoutMs = 1000): Promise<boolean> {
  const locator = page.getByTestId(testId);
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    await locator.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getStatePlayer(state: unknown): Record<string, unknown> | null {
  const record = getRecord(state);
  const players = Array.isArray(record.players) ? record.players : [];
  const currentPlayerIndex = Number(record.currentPlayerIndex ?? 0);
  const player = players[currentPlayerIndex];
  return player && typeof player === "object" ? player as Record<string, unknown> : null;
}

async function getProjectedState(agent: SmokeAgent, code: string) {
  const result = await api(agent, "GET", `/api/lobbies/${code}/state`, undefined, VERSION_HEADERS);
  if (!result.ok) {
    addIssue("high", "Projected state request failed", {
      agent: agent.name,
      status: result.status,
      body: result.body,
    });
  }
  return result;
}

async function signUpAgent(agent: SmokeAgent) {
  const result = await api(agent, "POST", "/api/auth/signup", {
    username: agent.username,
    password: agent.password,
  }, { "Content-Type": "application/json" });
  if (![200, 201].includes(result.status)) {
    addIssue("blocker", "Could not create live test user", {
      agent: agent.name,
      status: result.status,
      body: result.body,
    });
    throw new Error(`signup failed for ${agent.name}`);
  }
  agent.userId = Number(getRecord(result.body).id);
  logEvent("signed_up", { agent: agent.name, username: agent.username, userId: agent.userId });
}

async function createPublicLobby(host: SmokeAgent) {
  lobbyName = `Codex Live Public ${RUN_ID}`;
  const result = await api(host, "POST", "/api/lobbies", {
    name: lobbyName,
    maxPlayers: PLAYER_COUNT,
    mapSize: "tiny",
    authorityMode: "public_authoritative",
  });
  if (!result.ok) {
    addIssue("blocker", "Could not create public-authoritative lobby", {
      status: result.status,
      body: result.body,
    });
    throw new Error("public-authoritative lobby creation failed");
  }
  const body = getRecord(result.body);
  lobbyCode = String(body.code);
  lobbyId = Number(body.id);
  logEvent("lobby_created", { code: lobbyCode, lobbyId, lobbyName });
}

async function openLobbyByCode(agent: SmokeAgent, code: string) {
  const page = agent.page;
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await assertPageNotBlank(agent, "home");
  await page.getByTestId("main-menu-online-multiplayer").click({ timeout: 30_000 });

  try {
    await page.getByTestId("lobby-join-code-input").waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const pageState = await page.evaluate(() => ({
      url: location.href,
      text: document.body.innerText,
      htmlLength: document.body.innerHTML.length,
    })).catch((evalError) => ({ url: "", text: "", htmlLength: 0, error: String(evalError) }));
    addIssue("high", "Live deployment is missing lobby-list automation hooks", {
      agent: agent.name,
      expectedTestId: "lobby-join-code-input",
      pageState: {
        ...pageState,
        text: summarizeText(pageState.text),
      },
      error: String(error),
    });
    throw error;
  }

  await page.getByTestId("lobby-join-code-input").fill(code);
  await page.getByTestId("lobby-join-code-submit").click();

  try {
    await page.getByTestId("lobby-room").waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const text = await page.locator("body").innerText().catch(() => "");
    addIssue("high", "Browser did not enter lobby room after join-by-code", {
      agent: agent.name,
      expectedTestId: "lobby-room",
      text: summarizeText(text),
      error: String(error),
    });
    throw error;
  }

  const displayedCode = (await page.getByTestId("lobby-room-code").innerText()).trim();
  if (displayedCode !== code) {
    addIssue("high", "Joined lobby shows wrong room code", { agent: agent.name, displayedCode, expected: code });
  }

  const notice = await page.getByTestId("lobby-authority-notice").innerText().catch(() => "");
  if (!notice.includes("server-authoritative")) {
    addIssue("high", "Public lobby notice does not describe server authority", {
      agent: agent.name,
      notice: summarizeText(notice),
    });
  }
  if (notice.includes("still needs server-authoritative turns")) {
    addIssue("high", "Public lobby still shows stale private/demo warning", {
      agent: agent.name,
      notice: summarizeText(notice),
    });
  }

  await assertPageNotBlank(agent, "lobby");
  logEvent("ui_joined_lobby", { agent: agent.name, code });
}

async function configureSeat(agent: SmokeAgent) {
  const page = agent.page;
  const seat = `lobby-seat-${agent.seatIndex}`;

  if (agent.seatIndex > 0) {
    await page.getByTestId(`${seat}-claim`).click({ timeout: 15_000 });
    await page.getByTestId(`${seat}-player-name`).fill(agent.name);
    await page.getByTestId(`${seat}-join`).click();
  }

  await page.getByTestId(`${seat}-faction`).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByTestId(`${seat}-faction`).selectOption(agent.faction);
  await waitFor(`${agent.name} faction selection`, async () => {
    const value = await page.getByTestId(`${seat}-faction`).inputValue();
    return value === agent.faction ? true : false;
  }, 10_000);

  await waitFor(`${agent.name} ready button enabled`, async () => {
    const readyButton = page.getByTestId(`${seat}-ready`);
    return await readyButton.isEnabled().catch(() => false);
  }, 10_000);
  await page.getByTestId(`${seat}-ready`).click();
  await waitFor(`${agent.name} ready state`, async () => {
    const text = await page.getByTestId(`${seat}-ready`).innerText().catch(() => "");
    return text.includes("Ready!") ? true : false;
  }, 10_000);

  await capturePage(agent, `seat-${agent.seatIndex}-ready`);
  logEvent("ui_seat_ready", {
    agent: agent.name,
    seatIndex: agent.seatIndex,
    faction: agent.faction,
  });
}

async function startGameFromHost(host: SmokeAgent) {
  await host.page.getByTestId("lobby-refresh").click().catch(() => undefined);
  await waitFor("host start button enabled", async () => {
    const button = host.page.getByTestId("lobby-start-game");
    return await button.isEnabled().catch(() => false);
  }, 35_000);
  await host.page.getByTestId("lobby-start-game").click();
  logEvent("ui_start_clicked", { agent: host.name, code: lobbyCode });
}

async function waitForGameUi(agent: SmokeAgent) {
  const page = agent.page;
  await waitFor(`${agent.name} game UI`, async () => {
    const hasEndTurn = await page.getByTestId("hud-end-turn-button").isVisible().catch(() => false);
    const hasStartTurn = await page.getByTestId("handoff-start-turn-button").isVisible().catch(() => false);
    if (hasEndTurn || hasStartTurn) return true;
    const text = await page.locator("body").innerText().catch(() => "");
    return text.includes("Turn ") ? true : false;
  }, 60_000);
  await clickIfVisible(page, "tutorial-overlay-open-later", 1000);
  await assertPageNotBlank(agent, "game");
  await capturePage(agent, "game-start");
}

async function hydratePlayerAssignments(host: SmokeAgent, code: string) {
  const lobby = await api(host, "GET", `/api/lobbies/code/${code}`, undefined, VERSION_HEADERS);
  if (!lobby.ok) {
    addIssue("blocker", "Could not fetch started lobby for player assignments", {
      status: lobby.status,
      body: lobby.body,
    });
    throw new Error("missing started lobby assignments");
  }
  const gameState = getRecord(getRecord(lobby.body).gameState);
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  for (const player of players) {
    const playerRecord = getRecord(player);
    const userId = Number(playerRecord.userId);
    const agent = agents.find((candidate) => candidate.userId === userId);
    if (!agent) continue;
    agent.playerId = String(playerRecord.playerId);
    logEvent("player_assignment", {
      agent: agent.name,
      userId,
      playerId: agent.playerId,
      faction: playerRecord.factionId,
    });
  }
  if (agents.some((agent) => !agent.playerId)) {
    addIssue("blocker", "Could not map every smoke user to a game player id", {
      agents: agents.map((agent) => ({ name: agent.name, userId: agent.userId, playerId: agent.playerId })),
    });
    throw new Error("incomplete player assignments");
  }
}

async function waitForActiveTurn(agent: SmokeAgent) {
  await clickIfVisible(agent.page, "handoff-start-turn-button", 1000);
  await clickIfVisible(agent.page, "tutorial-overlay-open-later", 1000);
  await waitFor(`${agent.name} active turn controls`, async () => {
    return await agent.page.getByTestId("hud-end-turn-button").isVisible().catch(() => false);
  }, 40_000);
}

async function clickEndTurnAndWait(agent: SmokeAgent, code: string, beforeActionVersion: number) {
  await waitForActiveTurn(agent);
  await agent.page.getByTestId("hud-end-turn-button").click();
  const nextState = await waitFor(`${agent.name} action version advance`, async () => {
    const result = await getProjectedState(agent, code);
    const body = getRecord(result.body);
    const actionVersion = Number(body.actionVersion ?? 0);
    if (result.ok && actionVersion > beforeActionVersion && body.state) {
      return { body, actionVersion };
    }
    return false;
  }, 45_000, 1000);
  await assertPageNotBlank(agent, "after-end-turn");
  return nextState;
}

async function runTurnCycles(code: string) {
  const host = agents[0];
  let stateResult = await getProjectedState(host, code);
  let stateBody = getRecord(stateResult.body);
  let state = stateBody.state;
  let actionVersion = Number(stateBody.actionVersion ?? 0);

  if (!state) {
    addIssue("blocker", "No projected state after game start", { body: stateResult.body as Record<string, unknown> });
    throw new Error("missing projected state");
  }

  for (let index = 0; index < PLAYER_COUNT * ROUND_COUNT; index += 1) {
    const actor = getStatePlayer(state);
    const actorId = typeof actor?.id === "string" ? actor.id : null;
    const agent = agents.find((candidate) => candidate.playerId === actorId);
    if (!actorId || !agent) {
      addIssue("blocker", "Current actor is not controlled by a smoke agent", {
        turnIndex: index + 1,
        actor,
        agents: agents.map((candidate) => ({ name: candidate.name, playerId: candidate.playerId })),
      });
      throw new Error("uncontrolled actor");
    }

    const cycle = Math.floor(index / PLAYER_COUNT) + 1;
    logEvent("turn_begin", {
      cycle,
      turnIndex: index + 1,
      actorId,
      agent: agent.name,
      actionVersion,
      stateTurn: getRecord(state).turn,
    });

    const next = await clickEndTurnAndWait(agent, code, actionVersion);
    stateBody = next.body;
    state = stateBody.state;
    actionVersion = next.actionVersion;

    logEvent("turn_ended", {
      cycle,
      turnIndex: index + 1,
      agent: agent.name,
      actionVersion,
      snapshotVersion: stateBody.snapshotVersion,
      nextActor: getStatePlayer(state)?.id ?? null,
      stateTurn: getRecord(state).turn,
    });

    await Promise.all(agents.map((candidate) => assertPageNotBlank(candidate, `cycle-${cycle}`)));
  }
}

async function collectFinalStates(code: string) {
  for (const agent of agents) {
    const result = await getProjectedState(agent, code);
    const body = getRecord(result.body);
    const state = getRecord(body.state);
    const projectionPlayerIds = Array.isArray(body.projectionPlayerIds) ? body.projectionPlayerIds : [];
    if (projectionPlayerIds.length !== 1 || projectionPlayerIds[0] !== agent.playerId) {
      addIssue("high", "Projected state is not scoped to the requesting player", {
        agent: agent.name,
        playerId: agent.playerId,
        projectionPlayerIds,
      });
    }

    finalStates.push({
      agent: agent.name,
      status: result.status,
      actionVersion: body.actionVersion,
      snapshotVersion: body.snapshotVersion,
      authorityMode: body.authorityMode,
      projectionPlayerIds,
      stateTurn: state.turn,
      currentActor: getStatePlayer(body.state)?.id ?? null,
      hiddenTileCount: getRecord(state.projection).hiddenTileCount,
      visibleUnits: Array.isArray(state.units) ? state.units.length : null,
    });
    await capturePage(agent, "final");
  }
}

async function cleanupLobby() {
  if (!lobbyCode || KEEP_LOBBY || agents.length === 0) return;
  const host = agents[0];
  const result = await api(host, "DELETE", `/api/lobbies/${lobbyCode}`, undefined, VERSION_HEADERS);
  if (!result.ok && result.status !== 404) {
    addIssue("medium", "Temporary live lobby cleanup failed", {
      code: lobbyCode,
      status: result.status,
      body: result.body,
    });
    return;
  }
  logEvent("lobby_deleted", { code: lobbyCode, status: result.status });
}

async function writeReport() {
  const report = {
    runId: RUN_ID,
    baseUrl: BASE_URL,
    buildId: BUILD_ID ?? null,
    players: PLAYER_COUNT,
    rounds: ROUND_COUNT,
    lobby: {
      code: lobbyCode,
      id: lobbyId,
      name: lobbyName,
      kept: KEEP_LOBBY,
    },
    agents: agents.map((agent) => ({
      name: agent.name,
      username: agent.username,
      userId: agent.userId,
      seatIndex: agent.seatIndex,
      playerId: agent.playerId,
      faction: agent.faction,
      consoleErrors: agent.consoleMessages.filter((entry) => entry.type === "error"),
      failedRequests: agent.failedRequests,
      httpErrors: agent.httpErrors,
      ignoredRequests: agent.ignoredRequests,
    })),
    finalStates,
    events,
    issues,
    screenshots,
  };
  const file = path.join(OUTPUT_DIR, "report.json");
  await writeFile(file, JSON.stringify(report, null, 2));
  logEvent("report_written", { path: file, issueCount: issues.length });
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  logEvent("smoke_started", {
    baseUrl: BASE_URL,
    outputDir: OUTPUT_DIR,
    players: PLAYER_COUNT,
    rounds: ROUND_COUNT,
    headless: HEADLESS,
    buildId: BUILD_ID ?? null,
  });

  await preflightDeployedBundle();

  browser = await chromium.launch({ headless: HEADLESS });

  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const agent: SmokeAgent = {
      name: `player${index + 1}`,
      username: `cx${RUN_ID.slice(4)}p${index + 1}${randomUUID().slice(0, 4)}`,
      password,
      faction: FACTIONS[index],
      seatIndex: index,
      context,
      page,
      consoleMessages: [],
      failedRequests: [],
      httpErrors: [],
      ignoredRequests: [],
      isClosing: false,
    };

    page.on("console", (message) => {
      const text = message.text();
      agent.consoleMessages.push({ type: message.type(), text });
      if (message.type() === "error") {
        if (/Failed to load resource: the server responded with a status of \d+/i.test(text)) {
          return;
        }
        addIssue("medium", "Browser console error", { agent: agent.name, text });
      }
    });
    page.on("pageerror", (error) => {
      addIssue("high", "Browser page error", { agent: agent.name, error: String(error) });
    });
    page.on("requestfailed", (request) => {
      const url = request.url();
      const failure = request.failure();
      if (agent.isClosing) return;
      const ignoredReason = shouldIgnoreFailedRequest(url, failure?.errorText);
      if (ignoredReason) {
        agent.ignoredRequests.push({ url, errorText: failure?.errorText, reason: ignoredReason });
        return;
      }
      agent.failedRequests.push({ url, errorText: failure?.errorText });
      addIssue("medium", "Browser request failed", {
        agent: agent.name,
        url,
        errorText: failure?.errorText,
      });
    });
    page.on("response", (response) => {
      const status = response.status();
      if (agent.isClosing || status < 400 || !isSameOriginUrl(response.url())) return;
      const entry = { url: response.url(), status, statusText: response.statusText() };
      agent.httpErrors.push(entry);
      addIssue("medium", "Browser HTTP error response", {
        agent: agent.name,
        ...entry,
      });
    });

    agents.push(agent);
  }

  for (const agent of agents) {
    await signUpAgent(agent);
  }

  await createPublicLobby(agents[0]);
  if (!lobbyCode) throw new Error("missing lobby code after creation");

  await Promise.all(agents.map((agent) => openLobbyByCode(agent, lobbyCode!)));
  for (const agent of agents) {
    await configureSeat(agent);
  }
  await startGameFromHost(agents[0]);
  await Promise.all(agents.map(waitForGameUi));
  await hydratePlayerAssignments(agents[0], lobbyCode);
  await runTurnCycles(lobbyCode);
  await collectFinalStates(lobbyCode);
}

try {
  await main();
} catch (error) {
  addIssue("blocker", "Live public multiplayer smoke aborted", { error: error instanceof Error ? error.stack ?? error.message : String(error) });
  await Promise.all(agents.map(async (agent) => {
    if (agent.page.url() !== "about:blank") {
      await assertPageNotBlank(agent, "abort");
    }
    await capturePage(agent, "abort");
  })).catch((captureError) => {
    addIssue("medium", "Abort artifact capture failed", { error: String(captureError) });
  });
} finally {
  await cleanupLobby().catch((error) => {
    addIssue("medium", "Cleanup threw an exception", { error: String(error) });
  });
  for (const agent of agents) {
    agent.isClosing = true;
  }
  await writeReport().catch((error) => {
    console.error(`failed to write smoke report: ${String(error)}`);
  });
  for (const agent of agents) {
    await agent.context.close().catch(() => undefined);
  }
  await browser?.close().catch(() => undefined);
}

if (issues.some(isFatalIssue)) {
  process.exitCode = 1;
}
