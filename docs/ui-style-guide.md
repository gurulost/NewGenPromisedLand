# UI Style Guide

Last reviewed: 2026-04-30

This guide describes the current UI direction for Chronicles of the Promised Land. It is active guidance for new UI work and cleanup, not a completed migration checklist.

## Current Foundations

- Theme tokens live in `client/src/theme/tokens.ts`.
- Shared primitives live in `client/src/components/primitives/`.
- Common selectors live in `client/src/selectors/`.
- Resource delta badges currently live in `client/src/components/ui/WorldElementPanel.tsx` and are reused by `client/src/components/ui/VillageCapturePanel.tsx`.
- Core game panels currently remain single files such as `client/src/components/ui/CityPanel.tsx`, `client/src/components/ui/CombatPanel.tsx`, `client/src/components/ui/TechPanel.tsx`, and `client/src/components/hud/PlayerHUD.tsx`.

## Design Direction

- Use a restrained Mesoamerican scripture-fantasy look: stone, slate, amber/gold, parchment accents, and clear gameplay hierarchy.
- Prefer dense, readable strategy UI over decorative marketing composition.
- Keep cards and panels compact enough for repeated gameplay use.
- Make the current faction, selected unit, selected city, resources, and available actions scannable without hidden rules.
- Use tokens, primitives, and selectors before adding one-off Tailwind or inline logic.

## Shared Primitives

Use these before creating local variants:

- `PanelShell`: modal/panel shell with shared motion, close behavior, and scroll handling.
- `PanelHeader`: title, icon, scripture, description, and optional close affordance.
- `GlowingButton`: standard command button with disabled state and optional sound.
- `HUDShell`: anchored HUD container.
- `AvatarBadge`: faction/player identity marker.
- `InfoTooltip`: explanation surface for dense rules.

Expected hooks:

- `client/src/hooks/useHotkeys.ts`
- `client/src/hooks/useSfx.ts`
- `client/src/hooks/useReducedMotion.ts`

## Component Rules

- Keep gameplay rules out of React components. Use `shared/logic/*`, `client/src/selectors/*`, or thin UI adapters.
- Use `client/src/selectors/player.ts`, `client/src/selectors/city.ts`, `client/src/selectors/combat.ts`, and `client/src/selectors/tech.ts` for non-trivial derivations.
- Use `useMemo` for expensive pure derivations keyed to narrow state slices.
- Use `React.memo` only for leaf components that rerender often or appear in lists.
- Hooks come first, guards/checks second, returns last.
- Avoid nested cards; use sections, panels, rows, tabs, and lists instead.

## Gameplay Detail

Panels should expose the information a strategy player needs to decide:

- Action summary: what happens now.
- Cost: Stars/Faith/Pride/Dissent with clear sign and label.
- Requirements: visible when unmet.
- Immediate effects and permanent effects as separate groups when both exist.
- Population effects with the `population` token.
- Star costs with the `costStars` token.
- Consequences such as Pride/Dissent increases near the action button, not hidden in tooltips only.

`WorldElementPanel` is the current best reference for action sections and resource deltas. Do not assume it is perfect; copy the useful shape and improve shared pieces when duplication appears.

## Accessibility And Input

- Interactive overlays should use shared modal/provider primitives or Radix/Headless UI dialog patterns.
- Overlays must block map input explicitly and support keyboard close.
- Icons without visible labels need `aria-label`.
- Use accessible names for dialogs and major controls.
- Respect `prefers-reduced-motion`; use opacity changes instead of scale/rotation for reduced-motion users.
- Text must fit in controls at mobile and desktop sizes.

## Responsive Layout

- HUD should respect safe-area insets.
- Panels should cap height and scroll inside the content region, not the whole viewport.
- Avoid viewport-width font scaling. Use normal responsive layout constraints instead.
- Test compact mobile, tablet, laptop, and wide desktop sizes for overlap and clipped text.

## Motion And Feedback

- Use Framer Motion sparingly for panel entrance, exit, and small button feedback.
- Keep gameplay feedback fast. Do not delay turn actions behind decorative animation.
- Use sound through `useSfx`; do not call audio APIs directly from random components.
- Avoid motion that moves important text while the player is trying to read.

## Current Panel Notes

- `PlayerHUD`: should stay highly scannable and avoid expensive inline derivations.
- `WorldElementPanel`: reference for resource deltas, requirements, and action summaries.
- `CityPanel`: keep city growth, recruitment, and construction rules visible; move new rule derivations into selectors or shared logic.
- `CombatPanel`: combat odds and modifiers must be readable and accessible.
- `TechPanel`: keep tech prerequisites and effects visible without requiring hover-only discovery.

## Future Refactors

These are desired cleanup directions, not current file paths:

- Split very large panels into folders only when the split reduces complexity and keeps tests nearby.
- Extract `ResourceDeltaBadge` into a shared primitive if more panels need it.
- Move any hard-coded tech node layout into a dedicated data/layout file if the graph grows.
- Add more focused visual and accessibility tests around high-use panels.

## Quality Gates

- Run focused component tests when changing a panel.
- Run accessibility tests when changing overlays, dialogs, or control names.
- Use Playwright or screenshots for layout-sensitive changes.
- Keep `npm run check` green before handing off.
