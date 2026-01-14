import { GameState } from "../types/game";
import { resolveCombat } from "./combatResolver";
import { resolveAction, ResolveContext, ResolveResult } from "./resolveAction";

export { resolveCombat };

export function resolveAttack(
  state: GameState,
  attackerId: string,
  defenderId: string,
  ctx: ResolveContext = {}
): ResolveResult {
  return resolveAction(
    state,
    { type: 'ATTACK_UNIT', payload: { attackerId, targetId: defenderId } } as const,
    ctx
  );
}
