import { randomUUID } from "node:crypto";

export type LiveMultiplayerUserMode = "configured-accounts" | "dedicated-prefix" | "run-scoped";

export type LiveMultiplayerUserCredential = {
  username: string;
  password: string;
  mode: LiveMultiplayerUserMode;
  shouldReuse: boolean;
};

export type LiveMultiplayerAccountAgent = {
  name: string;
  username: string;
  password: string;
  userId?: number;
  testUserMode: LiveMultiplayerUserMode;
  shouldReuseTestUser: boolean;
};

type AccountApiResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

type AccountProvisionerOptions<TAgent extends LiveMultiplayerAccountAgent> = {
  api: (agent: TAgent, method: string, path: string, data?: unknown, headers?: Record<string, string>) => Promise<AccountApiResult>;
  getRecord: (value: unknown) => Record<string, unknown>;
  logEvent: (type: string, detail?: Record<string, unknown>) => void;
  addIssue: (severity: "blocker", title: string, detail?: Record<string, unknown>) => void;
};

type LiveMultiplayerUserPlanOptions = {
  args: string[];
  env?: NodeJS.ProcessEnv;
  playerCount: number;
  runId: string;
  scenarioMode: "smoke" | "soak";
};

function readArg(args: string[], name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1] ?? fallback;
  return fallback;
}

function normalizePrefix(raw: string | undefined): string {
  const normalized = (raw ?? "clt").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return normalized || "clt";
}

function parseConfiguredUsers(raw: string | undefined): Array<{ username: string; password: string }> {
  if (!raw?.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("COVENANT_SMOKE_USERS must be a JSON array");
  }
  return parsed.map((entry, index) => {
    if (typeof entry === "string") {
      const separator = entry.indexOf(":");
      if (separator > 0) {
        return { username: entry.slice(0, separator), password: entry.slice(separator + 1) };
      }
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      if (typeof record.username === "string" && typeof record.password === "string") {
        return { username: record.username, password: record.password };
      }
    }
    throw new Error(`Invalid COVENANT_SMOKE_USERS entry at index ${index}`);
  });
}

export function createLiveMultiplayerTestUserPlan({
  args,
  env = process.env,
  playerCount,
  runId,
  scenarioMode,
}: LiveMultiplayerUserPlanOptions): {
  mode: LiveMultiplayerUserMode;
  prefix: string;
  users: LiveMultiplayerUserCredential[];
  cleanupNote: string;
} {
  const prefix = normalizePrefix(readArg(args, "smoke-user-prefix", env.COVENANT_SMOKE_USER_PREFIX));
  const configuredUsers = parseConfiguredUsers(readArg(args, "smoke-users-json", env.COVENANT_SMOKE_USERS));

  if (configuredUsers.length > 0) {
    if (configuredUsers.length < playerCount) {
      throw new Error(`Need ${playerCount} configured smoke users, received ${configuredUsers.length}`);
    }
    return {
      mode: "configured-accounts",
      prefix,
      users: configuredUsers.slice(0, playerCount).map((user) => ({
        ...user,
        mode: "configured-accounts",
        shouldReuse: true,
      })),
      cleanupNote: "Configured smoke accounts are reused and should remain dedicated to automated multiplayer checks.",
    };
  }

  const sharedPassword = readArg(args, "smoke-user-password", env.COVENANT_SMOKE_USER_PASSWORD);
  if (sharedPassword) {
    const scenarioLabel = scenarioMode === "soak" ? "soak" : "smk";
    return {
      mode: "dedicated-prefix",
      prefix,
      users: Array.from({ length: playerCount }, (_, index) => ({
        username: `${prefix}${scenarioLabel}p${index + 1}`,
        password: sharedPassword,
        mode: "dedicated-prefix",
        shouldReuse: true,
      })),
      cleanupNote: "Dedicated prefix smoke accounts are reused; rotate COVENANT_SMOKE_USER_PASSWORD if these accounts are reset.",
    };
  }

  const runPassword = `CodexSmoke-${runId}-${randomUUID().slice(0, 10)}`;
  return {
    mode: "run-scoped",
    prefix,
    users: Array.from({ length: playerCount }, (_, index) => ({
      username: `${prefix}${runId.slice(2, 12)}p${index + 1}${randomUUID().slice(0, 3)}`,
      password: runPassword,
      mode: "run-scoped",
      shouldReuse: false,
    })),
    cleanupNote: "Run-scoped users are tagged by username prefix. Set COVENANT_SMOKE_USER_PASSWORD or COVENANT_SMOKE_USERS to reuse a bounded production test account pool.",
  };
}

export function createLiveMultiplayerAccountProvisioner<TAgent extends LiveMultiplayerAccountAgent>({
  api,
  getRecord,
  logEvent,
  addIssue,
}: AccountProvisionerOptions<TAgent>) {
  const signUpAgent = async (agent: TAgent): Promise<boolean> => {
    const result = await api(agent, "POST", "/api/auth/signup", {
      username: agent.username,
      password: agent.password,
    }, { "Content-Type": "application/json" });
    if (result.status === 409 && agent.shouldReuseTestUser) {
      logEvent("test_user_exists", { agent: agent.name, username: agent.username, mode: agent.testUserMode });
      return false;
    }
    if (![200, 201].includes(result.status)) {
      addIssue("blocker", "Could not create live test user", {
        agent: agent.name,
        status: result.status,
        body: result.body,
      });
      throw new Error(`signup failed for ${agent.name}`);
    }
    agent.userId = Number(getRecord(result.body).id);
    logEvent("signed_up", { agent: agent.name, username: agent.username, userId: agent.userId, mode: agent.testUserMode });
    return true;
  };

  const logInAgent = async (agent: TAgent) => {
    const result = await api(agent, "POST", "/api/auth/login", {
      username: agent.username,
      password: agent.password,
    }, { "Content-Type": "application/json" });
    if (!result.ok) {
      addIssue("blocker", "Could not log live test user back in", {
        agent: agent.name,
        status: result.status,
        body: result.body,
      });
      throw new Error(`login failed for ${agent.name}`);
    }
    agent.userId = Number(getRecord(result.body).id);
    logEvent("logged_in", { agent: agent.name, username: agent.username, userId: agent.userId, mode: agent.testUserMode });
  };

  const ensureAgentAccount = async (agent: TAgent) => {
    if (agent.shouldReuseTestUser) {
      const loginAttempt = await api(agent, "POST", "/api/auth/login", {
        username: agent.username,
        password: agent.password,
      }, { "Content-Type": "application/json" });
      if (loginAttempt.ok) {
        agent.userId = Number(getRecord(loginAttempt.body).id);
        logEvent("test_user_reused", { agent: agent.name, username: agent.username, userId: agent.userId, mode: agent.testUserMode });
        return;
      }
      if (loginAttempt.status !== 401) {
        addIssue("blocker", "Could not check reusable live test user", {
          agent: agent.name,
          status: loginAttempt.status,
          body: loginAttempt.body,
        });
        throw new Error(`reusable login failed for ${agent.name}`);
      }
    }
    const created = await signUpAgent(agent);
    if (!created) await logInAgent(agent);
  };

  return { ensureAgentAccount, logInAgent };
}
