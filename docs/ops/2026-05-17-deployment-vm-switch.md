# 2026-05-17 — Switch published deployment off autoscale (Task #4)

## Action taken from the task agent

The task agent updated the publishing service configuration via the platform's
`deployConfig()` callback. The Replit publishing config is now:

```
deploymentTarget: "vm"
build:            ["npm", "run", "build"]
run:              ["npm", "run", "start"]
```

Service response:

```
{
  "success": true,
  "message": "Publishing configuration was updated successfully.",
  "deploymentTarget": "vm",
  "run":   ["npm", "run", "start"],
  "build": ["npm", "run", "build"],
  "publicDir": null,
  "reminder": "This deployment configuration has been saved, but the user
   will need to publish from the main version of the project after this
   task is merged. Remind the user about this."
}
```

This matches what `.replit` already declares in `[deployment]`
(`deploymentTarget = "vm"`).

## Why the live deployment still shows autoscale

`getDeploymentInfo()` from inside the task agent (after `deployConfig()`):

```
{
  "success": true,
  "isDeployed": true,
  "primaryUrl": "https://covenantlegends.com",
  "additionalUrls": ["https://PromisedLandChronicles.replit.app"],
  "deploymentType": "autoscale",
  "hasSuccessfulBuild": true,
  "visibility": "public"
}
```

The currently live deployment is still autoscale because saving the
publishing config does not redeploy. A republish is required to roll the
new `vm` config out to production. Task agents cannot trigger a publish —
only the main project can — so this last step is on the user.

## Required user follow-up (after Task #4 merges)

1. Open the Replit Publishing tool from the main project.
2. Click **Publish** to redeploy with the saved `vm` configuration.
   - Alternative: keep autoscale, but in Publishing → Advanced settings
     set **Max instances = 1**. More than one autoscaled instance silently
     breaks lobby/SSE sync because the realtime broker is in-memory and
     process-local.
3. Verify with `getDeploymentInfo()` that `deploymentType` reads `"vm"`
   (or that autoscale max instances is 1).
4. Two-client multiplayer smoke test:
   - Two separate browsers/devices join the same lobby.
   - Confirm lobby join, ready toggle, action commits, and end-turn events
     propagate live between both clients without manual refresh.
   - If events stop propagating, the deployment is still multi-process —
     do not proceed and revisit the Publishing settings.

## Related changes in this task

- `replit.md` → Multiplayer Operations → Deployment topology: documents
  the `vm` requirement and the autoscale max-1-instance fallback.
- `docs/MULTIPLAYER_PRIVATE_DEMO_REPLIT.md` → Replit Deployment
  Requirements: same requirement plus the post-republish smoke test.
