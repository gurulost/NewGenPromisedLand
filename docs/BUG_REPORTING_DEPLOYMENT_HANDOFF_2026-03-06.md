# Bug Reporting Deployment Handoff

Date: 2026-03-06

Audience: deployment agent / operator

## Executive Summary

The bug-reporting system is now merged into `main` and passed local validation plus GitHub CI.

Current production-sensitive status:

- Code status: complete and merged
- GitHub status: replacement PR merged, old PR closed, checks green
- Database status: schema push still required in the real environment
- Runtime config status: optional screenshot/webhook features still require env setup

This means the feature is not blocked by code anymore. The remaining work is environment setup and one schema application step.

## Source Of Truth

- Branch to deploy: `main`
- Merged PR: [#13](https://github.com/gurulost/NewGenPromisedLand/pull/13)
- Merge commit on `main`: `aaa2516e23f82c32e45b1b5e3cf037e2353a6697`
- Superseded PR: [#12](https://github.com/gurulost/NewGenPromisedLand/pull/12) (closed)

Local repo state at handoff:

- `main` is clean
- `main` is synced with `origin/main`
- no open PRs remain for this work

## What Is Included In `main`

### Bug Reporting

- In-game bug report launcher in [client/src/components/game/GameUI.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/game/GameUI.tsx)
- Mobile report entry in [client/src/components/hud/MobileHUD.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/hud/MobileHUD.tsx)
- Global bug report host in [client/src/components/ui/BugReportHost.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportHost.tsx)
- Report dialog in [client/src/components/ui/BugReportDialog.tsx](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/BugReportDialog.tsx)
- Client diagnostics, offline queueing, idempotent retry, and screenshot flow in [client/src/utils/bugReport.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts)
- Critical error report entry in [client/src/utils/errorReporting.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/errorReporting.ts)
- Server intake and validation in [server/routes.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts) and [server/bugReports.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/bugReports.ts)
- Screenshot upload/delete helpers in [server/r2.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/r2.ts)
- Shared request/response types in [shared/types/bugReport.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/shared/types/bugReport.ts)
- Database table definition in [shared/schema.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/shared/schema.ts)

### Related Reconciliation Work Also Merged

- Voice chat retry fix
- Gameplay telemetry correlation IDs
- PostHog dashboard setup artifacts
- CI hardening:
  - Git LFS checkout removal in normal CI
  - `bufferutil` lockfile sync fix
  - minimal game canvas for CI e2e
- `claude-review` now gated behind a `claude` label in [/.github/workflows/claude-code-review.yml](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/.github/workflows/claude-code-review.yml)

## Why Deployment Work Still Remains

The code alone is not enough for full functionality because this feature depends on external state:

1. the database must contain the `bug_reports` table
2. screenshot uploads require Cloudflare R2 credentials and browser CORS
3. webhook alerts require a configured webhook URL

Those are intentionally not done automatically in a generic local merge flow because they mutate real infrastructure.

## Required Deployment Steps

### 1. Deploy From `main`

Deploy commit:

```bash
git checkout main
git pull origin main
git rev-parse HEAD
```

Expected deployed commit at handoff:

```bash
aaa2516e23f82c32e45b1b5e3cf037e2353a6697
```

Why:

- this is the merge commit that contains the reconciled bug-reporting, telemetry, voice retry, and CI work

### 2. Apply Database Schema

Run in the environment that has the real `DATABASE_URL`:

```bash
npm run db:push
```

Source:

- script is defined in [/package.json](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/package.json)
- schema lives in [/shared/schema.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/shared/schema.ts)

What this adds:

- `bug_reports` table
- unique `submission_id`
- bug-report payload storage fields

Why this is required:

- the API endpoint `/api/bug-reports` persists into `bug_reports`
- without this push, bug-report submissions can fail at runtime when the table/index does not exist

### 3. Build And Start Normally

Typical commands:

```bash
npm ci
npm run build
npm start
```

Why:

- confirms the merged code builds in the deployment environment
- serves both the client and server bundle expected by the new routes

## Runtime Configuration Matrix

### Required For Core Bug Reporting

Core bug reporting works once:

- code from `main` is deployed
- `npm run db:push` has been run against the real database

No webhook or R2 setup is required for plain text bug reports with diagnostics.

### Optional: Screenshot Uploads

Set these env vars:

```bash
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://cdn.example.com/assets
```

Sources:

- [/server/r2.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/r2.ts)
- [/.env.example](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/.env.example)

Why:

- the client uploads screenshots using presigned URLs
- the server only enables that path when all five `R2_*` variables are present

What happens if this is skipped:

- bug reports still work
- screenshot uploads are disabled/skipped

### Optional: Browser CORS For R2 Screenshot Uploads

Cloudflare R2 bucket CORS must allow direct browser `PUT` uploads.

Required rule from [/server/r2.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/r2.ts):

```text
AllowedOrigins: ["https://your-app-domain"]
AllowedMethods: ["PUT"]
AllowedHeaders: ["Content-Type"]
```

Why:

- the browser uploads directly to the presigned URL
- without this, the request will be blocked by the browser even if the credentials are correct

What happens if this is skipped:

- report submission still works
- screenshot upload will fail client-side

### Optional: Webhook Alerts

Set:

```bash
BUG_REPORT_WEBHOOK_URL=https://hooks.example.com/services/...
```

Sources:

- [/.env.example](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/.env.example)
- [/server/routes.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/server/routes.ts)

Why:

- sends immediate notifications for newly submitted player bug reports

What happens if this is skipped:

- reports are still stored in the database
- no realtime alert is sent

### Optional: Direct "Full Report" Links In Alerts

Set:

```bash
BUG_REPORT_PUBLIC_URL=https://your-app.example.com
BUG_REPORT_VIEW_TOKEN=replace-with-a-long-random-secret
```

Why:

- lets Slack/Discord alerts include a direct link to the full stored bug report payload
- the link resolves to `/api/bug-reports/:reportId?token=...`
- this is the easiest generic way to get from an alert to the full diagnostics JSON without building an admin UI first

What happens if this is skipped:

- alerts still work
- no direct full-report link is included

### Optional: Direct DB/Admin Links In Alerts

Set:

```bash
BUG_REPORT_DB_URL_TEMPLATE=https://db.example.com/bug_reports?id={id}
```

Supported placeholders:

- `{id}`
- `{reportId}`
- `{submissionId}`
- `{fingerprint}`
- `{category}`
- `{source}`
- `{createdAt}`

Why:

- direct links into a database/admin console are vendor-specific
- this template lets the operator wire in the correct deep-link pattern for their DB tool if one exists

What happens if this is skipped:

- alerts still include a non-clickable DB lookup hint like `bug_reports.id=42`
- no direct DB/admin hyperlink is included

### Optional: Hide The Launcher

Set:

```bash
VITE_BUG_REPORTING_ENABLED=false
```

Source:

- [/client/src/utils/bugReport.ts](/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/utils/bugReport.ts)

Why:

- this is a client-side kill switch for the in-game launcher

Default behavior:

- if unset, bug reporting remains enabled

## Exact Feature Behavior After Correct Setup

### Player-Facing

- desktop players see `Something not working?`
- mobile players can open `Report Issue`
- critical error dialogs offer `Report This`
- React error boundary also offers a report path

### Data Captured

- player-written message
- expected behavior
- repro frequency
- optional contact field
- diagnostics bundle
- optional screenshot URL if R2 is configured
- idempotent `submissionId` for retry safety
- dedupe fingerprint and duplicate count

### Retry Behavior

- temporary failures queue locally
- queued reports are retried later
- duplicate submissions are prevented by `submissionId`

## Validation Already Completed

### Local Validation

- `npm run check`
- `npm run lint`
- `npm run build`
- `npx vitest run test/BugReportDialog.test.tsx test/server/bugReports.test.ts client/src/utils/__tests__/bugReport.test.ts test/unit/GameplayAnalytics.unit.test.ts --reporter=dot`
- `CI=1 npx playwright test test/e2e`

Result:

- all passed
- only existing lint warnings remained in `PlayerHUD.tsx`

### GitHub Validation

PR `#13` passed:

- `merge-gate`
- `unit-tests`
- `accessibility-tests`
- `e2e-tests`
- `lighthouse-audit`
- `performance-tests`
- `responsive-tests`
- `visual-regression`

`claude-review`:

- intentionally skipped unless the PR has a `claude` label

## Deployment Verification Checklist

After deploy, verify the following manually:

1. open the game and confirm the desktop launcher text `Something not working?` appears
2. open the mobile menu and confirm `Report Issue` exists
3. submit a plain bug report without screenshot and confirm success
4. confirm a row appears in `bug_reports`
5. if R2 is configured, submit with screenshot and confirm the `screenshot_url` is stored and publicly reachable
6. if webhook is configured, confirm a webhook notification arrives
7. trigger a temporary network failure and confirm queued retry behavior works after reconnect

## Operator Decision Table

### Minimum Viable Deployment

Do this if you only want the core bug reporter live:

1. deploy `main`
2. run `npm run db:push`

Result:

- players can report issues
- diagnostics persist
- no screenshots
- no webhook alerts

### Full Deployment

Do this if you want the full intended system:

1. deploy `main`
2. run `npm run db:push`
3. configure all `R2_*` vars
4. configure R2 bucket CORS
5. set `BUG_REPORT_WEBHOOK_URL`

Result:

- full bug reporting
- diagnostics
- screenshot uploads
- webhook alerts

## Known Non-Blocking Notes

- The old Git LFS checkout problem in CI was addressed by the merged CI workflow changes.
- The old always-on `claude-review` failure was addressed by label-gating the workflow.
- The deployment agent should not rebuild the bug-report feature from scratch in another workspace. It is already in `main`.

## Recommended Next Action For Deployment Agent

If this is a real deployment pass, do the following in order:

```bash
git checkout main
git pull origin main
npm ci
npm run db:push
npm run build
npm start
```

Then add the optional environment configuration for screenshots and webhooks if those features are desired.
