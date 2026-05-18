import { describe, expect, it, vi } from 'vitest';

import {
  createLiveMultiplayerAccountProvisioner,
  createLiveMultiplayerTestUserPlan,
  type LiveMultiplayerAccountAgent,
} from '../../scripts/liveMultiplayerTestUsers';

type ApiResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

function makeAgent(overrides: Partial<LiveMultiplayerAccountAgent> = {}): LiveMultiplayerAccountAgent {
  return {
    name: 'player1',
    username: 'cltsmkp1',
    password: 'shared-secret',
    testUserMode: 'dedicated-prefix',
    shouldReuseTestUser: true,
    ...overrides,
  };
}

describe('createLiveMultiplayerTestUserPlan', () => {
  it('labels fallback run-scoped users with a compact cleanup prefix', () => {
    const plan = createLiveMultiplayerTestUserPlan({
      args: [],
      env: env({}),
      playerCount: 3,
      runId: '20260518010101',
      scenarioMode: 'smoke',
    });

    expect(plan.mode).toBe('run-scoped');
    expect(plan.prefix).toBe('clt');
    expect(plan.users).toHaveLength(3);
    expect(new Set(plan.users.map((user) => user.password))).toHaveLength(1);
    expect(plan.cleanupNote).toContain('Run-scoped users are tagged');

    plan.users.forEach((user, index) => {
      expect(user.username).toMatch(new RegExp(`^clt2605180101p${index + 1}[a-f0-9]{3}$`));
      expect(user.username.length).toBeLessThanOrEqual(20);
      expect(user.mode).toBe('run-scoped');
      expect(user.shouldReuse).toBe(false);
    });
  });

  it('uses bounded reusable accounts when a smoke password is configured', () => {
    const plan = createLiveMultiplayerTestUserPlan({
      args: ['--smoke-user-prefix', 'QA-Auto'],
      env: env({ COVENANT_SMOKE_USER_PASSWORD: 'shared-secret' }),
      playerCount: 4,
      runId: '20260518010101',
      scenarioMode: 'soak',
    });

    expect(plan.mode).toBe('dedicated-prefix');
    expect(plan.prefix).toBe('qaaut');
    expect(plan.users.map((user) => user.username)).toEqual(['qaautsoakp1', 'qaautsoakp2', 'qaautsoakp3', 'qaautsoakp4']);
    expect(plan.users.every((user) => user.password === 'shared-secret')).toBe(true);
    expect(plan.users.every((user) => user.shouldReuse)).toBe(true);
  });

  it('uses explicitly configured smoke accounts before prefix accounts', () => {
    const plan = createLiveMultiplayerTestUserPlan({
      args: ['--smoke-users-json', JSON.stringify(['alpha:pw1', { username: 'beta', password: 'pw2' }])],
      env: env({ COVENANT_SMOKE_USER_PASSWORD: 'shared-secret' }),
      playerCount: 2,
      runId: '20260518010101',
      scenarioMode: 'smoke',
    });

    expect(plan.mode).toBe('configured-accounts');
    expect(plan.users).toEqual([
      { username: 'alpha', password: 'pw1', mode: 'configured-accounts', shouldReuse: true },
      { username: 'beta', password: 'pw2', mode: 'configured-accounts', shouldReuse: true },
    ]);
  });

  it('fails early when too few configured accounts are supplied', () => {
    expect(() => createLiveMultiplayerTestUserPlan({
      args: [],
      env: env({ COVENANT_SMOKE_USERS: JSON.stringify([{ username: 'only-one', password: 'pw' }]) }),
      playerCount: 2,
      runId: '20260518010101',
      scenarioMode: 'smoke',
    })).toThrow('Need 2 configured smoke users');
  });
});

describe('createLiveMultiplayerAccountProvisioner', () => {
  it('reuses an existing live test account without trying to sign up again', async () => {
    const agent = makeAgent();
    const api = vi.fn(async (): Promise<ApiResult> => ({ status: 200, ok: true, body: { id: 42 } }));
    const logs: Array<{ type: string; detail?: Record<string, unknown> }> = [];
    const issues: Array<{ title: string; detail?: Record<string, unknown> }> = [];
    const provisioner = createLiveMultiplayerAccountProvisioner({
      api,
      getRecord: (value) => value as Record<string, unknown>,
      logEvent: (type, detail) => logs.push({ type, detail }),
      addIssue: (_severity, title, detail) => issues.push({ title, detail }),
    });

    await provisioner.ensureAgentAccount(agent);

    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0][2]).toBe('/api/auth/login');
    expect(agent.userId).toBe(42);
    expect(logs.map((entry) => entry.type)).toEqual(['test_user_reused']);
    expect(issues).toHaveLength(0);
  });

  it('falls back from a reusable signup conflict to login', async () => {
    const agent = makeAgent();
    const results: ApiResult[] = [
      { status: 401, ok: false, body: { message: 'invalid credentials' } },
      { status: 409, ok: false, body: { message: 'user exists' } },
      { status: 200, ok: true, body: { id: 77 } },
    ];
    const api = vi.fn(async (): Promise<ApiResult> => {
      const result = results.shift();
      if (!result) throw new Error('unexpected api call');
      return result;
    });
    const logs: Array<{ type: string; detail?: Record<string, unknown> }> = [];
    const provisioner = createLiveMultiplayerAccountProvisioner({
      api,
      getRecord: (value) => value as Record<string, unknown>,
      logEvent: (type, detail) => logs.push({ type, detail }),
      addIssue: vi.fn(),
    });

    await provisioner.ensureAgentAccount(agent);

    expect(api.mock.calls.map((call) => call[2])).toEqual(['/api/auth/login', '/api/auth/signup', '/api/auth/login']);
    expect(agent.userId).toBe(77);
    expect(logs.map((entry) => entry.type)).toEqual(['test_user_exists', 'logged_in']);
  });
});
