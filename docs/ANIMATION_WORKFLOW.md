# Animation Workflow

This project standardizes animated unit assets and clip metadata to keep onboarding safe and consistent.

## 1) Import the animated GLB (standard naming)

Use the import script to copy/rename merged animation files:

```bash
scripts/animation/import_animated_model.py \
  --unit warrior \
  --src /path/to/Meshy_AI_Meshy_Merged_Animations.glb
```

This copies the file to:

```
client/public/models/<unit>_animated.glb
```

## 2) Extract clip durations (auto‑write to registry)

```bash
scripts/animation/extract_clip_durations.py \
  /path/to/<unit>_animated.glb \
  --update-registry client/src/utils/unitAnimationRegistry.ts \
  --unit warrior
```

## 3) Configure animation behavior

Edit `client/src/utils/unitAnimationRegistry.ts`:

- `animatedModelPath`: `/models/<unit>_animated.glb`
- `clips`: map `idle/move/attack/hit/death/celebrate/ability` to clip names (with weights)
- `moveSpeedTilesPerSec`, `yawOffset`

## 4) Optional: Verify in game

- High‑perf mode only (animations are disabled in low‑perf by design).
- Idle clips cycle every 15s by default.

## Notes

- Event animations (attack/hit/death/celebrate) use clip‑accurate durations when available.
- If a non‑looping state has no clips configured, it will be skipped rather than falling back.

