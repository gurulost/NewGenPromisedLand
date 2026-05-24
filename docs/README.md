# Documentation Index

This directory contains current reference documentation for Covenant Legends.

Historical checklists, implementation notes, backup records, and one-time audit artifacts are archived under [docs/archive](./archive/README.md). They are useful for forensic context, but they are not active guidance.

## Active References

- [PLAYER_REFERENCE.md](./PLAYER_REFERENCE.md) - current player-facing rules and systems reference
- [UNIT_SYSTEM_DESIGN.md](./UNIT_SYSTEM_DESIGN.md) - unit roster, faction unit identity, and known unit-system gaps
- [ANIMATION_WORKFLOW.md](./ANIMATION_WORKFLOW.md) - animated GLB import and clip metadata workflow
- [ui-style-guide.md](./ui-style-guide.md) - UI design, layout, and accessibility guidance
- [ERROR_LOGGING.md](./ERROR_LOGGING.md) - runtime error reporting, bug report intake, and monitoring setup
- [GAME_ANALYTICS.md](./GAME_ANALYTICS.md) - gameplay telemetry setup and event catalog
- [POSTHOG_DASHBOARD_SPEC.md](./POSTHOG_DASHBOARD_SPEC.md) - dashboard configuration for gameplay tuning
- [RULES_SINGLE_SOURCE_OF_TRUTH.md](./RULES_SINGLE_SOURCE_OF_TRUTH.md) - current rules ownership policy and remaining drift risks
- [COVENANT_LEGENDS_OPERATING_GUIDE.md](./COVENANT_LEGENDS_OPERATING_GUIDE.md) - repo-specific operating guide for future work
- [PUBLIC_RELEASE_READINESS_RUBRIC.md](./PUBLIC_RELEASE_READINESS_RUBRIC.md) - go/no-go rubric for public release confidence
- [ACTIVE_FACTION_ABILITIES.md](./ACTIVE_FACTION_ABILITIES.md) - active faction ability contract, balance notes, and validation policy
- [MULTIPLAYER_PRIVATE_DEMO_REPLIT.md](./MULTIPLAYER_PRIVATE_DEMO_REPLIT.md) - private/demo multiplayer deployment contract and Replit backend requirements
- [MULTIPLAYER_PUBLIC_AUTHORITATIVE.md](./MULTIPLAYER_PUBLIC_AUTHORITATIVE.md) - public server-authoritative multiplayer contract, Replit requirements, and rollout checks
- [MAP_GENERATOR_SPLIT_PLAN.md](./MAP_GENERATOR_SPLIT_PLAN.md) - behavior-preserving plan for splitting the large procedural map generator

## Repo-Level References

- [../README.md](../README.md) - project overview and current release gates
- [../TESTING.md](../TESTING.md) - local and CI test policy
- [../AGENTS.md](../AGENTS.md) - agent-specific engineering rules and recurring bug lessons
- [../replit.md](../replit.md) - Replit/development environment guide

## Documentation Policy

Keep current docs short, directly actionable, and tied to the actual codebase.

Use `docs/archive/` for:

- completed production checklists
- one-time implementation summaries
- historical testing reports
- old branch/worktree cleanup notes
- stale audit snapshots that no longer describe the current code

When a historical checklist still contains a useful decision, copy the decision into an active reference doc, then keep the checklist archived.
