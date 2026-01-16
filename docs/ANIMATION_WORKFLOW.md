# Animation Workflow

This project standardizes animated unit assets and clip metadata to keep onboarding safe and consistent.

## What you need from the artist

Preferred inputs (in order):
- A merged animations GLB (single file that includes all clips).
- Optional: a “broken out” folder per-clip for inspection (not required for integration).
- Optional: a static character GLB (not required if merged is provided).

If possible, ask for clear clip names that reflect intent (idle/move/attack/etc).

## 1) Import the merged animated GLB (standard naming)

Use the import script to copy/rename merged animation files. This is the only
GLB we load at runtime for the unit:

```bash
scripts/animation/import_animated_model.py \
  --unit warrior \
  --src /path/to/Meshy_AI_Meshy_Merged_Animations.glb
```

This copies the file to:

```
client/public/models/<unit>_animated.glb
```

## 2) Extract clip durations (always do this)

```bash
scripts/animation/extract_clip_durations.py \
  /path/to/<unit>_animated.glb \
  --update-registry client/src/utils/unitAnimationRegistry.ts \
  --unit warrior
```

This writes clip durations into the registry so event animations (attack/hit/death/celebrate)
can end at the correct time instead of a fixed fallback.

## 3) Audit clip list and propose state mapping

Before wiring anything, list the clips and propose a mapping for review:
- **Idle**: standing loops or small fidgets.
- **Move**: walk/run/sneak variants.
- **Attack**: combat initiation.
- **Hit**: reaction when damaged (if present).
- **Death**: final pose (if present).
- **Celebrate**: victory, rewards, fun emotes.
- **Ability**: unit‑specific special actions (optional).

Provide this mapping to the lead for approval + weights.

## 4) Configure animation behavior

Edit `client/src/utils/unitAnimationRegistry.ts`:

- `animatedModelPath`: `/models/<unit>_animated.glb`
- `clips`: map `idle/move/attack/hit/death/celebrate/ability` to clip names (with weights)
- `moveSpeedTilesPerSec`, `yawOffset`

## 5) Optional: Verify in game

- High‑perf mode only (animations are disabled in low‑perf by design).
- Idle clips cycle every 15s by default.

## Integration Checklist

- Imported merged GLB via `import_animated_model.py`.
- Ran `extract_clip_durations.py` and registry updated.
- New unit entry added to `unitAnimationRegistry.ts`.
- Weights + states approved by lead.
- (Optional) `yawOffset` adjusted if model faces wrong direction.
- (Optional) `moveSpeedTilesPerSec` set for unit identity.

## Notes / gotchas

- Event animations (attack/hit/death/celebrate) use clip‑accurate durations when available.
- If a non‑looping state has no clips configured, it will be skipped rather than falling back.
