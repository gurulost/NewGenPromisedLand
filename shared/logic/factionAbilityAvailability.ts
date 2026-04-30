import { ABILITIES } from "../data/abilities";
import { FACTIONS } from "../data/factions";
import {
  getFactionAbilitySpec,
  type FactionAbilityResourceCost,
  type FactionAbilitySpec,
} from "../data/factionAbilitySpecs";
import type { AbilityDefinition } from "../data/abilities";
import type { GameState, PlayerState } from "../types/game";
import type { FactionAbility } from "../types/faction";
import { normalizeAbility } from "./actions/helpers";
import { getTestimonyPressureSelection } from "./testimonyPressure";

export type FactionAbilityAvailabilityReason =
  | "missing_player"
  | "game_ended"
  | "not_current_turn"
  | "unknown_ability"
  | "not_faction_ability"
  | "not_owned"
  | "passive_only"
  | "triggered_only"
  | "missing_spec"
  | "spec_owner_mismatch"
  | "design_pending"
  | "disabled"
  | "cooldown"
  | "requirements"
  | "no_valid_source"
  | "no_valid_targets";

export type FactionAbilityAvailability =
  | {
    available: true;
    ability: AbilityDefinition;
    factionAbility: FactionAbility;
    spec: FactionAbilitySpec;
  }
  | {
    available: false;
    reason: FactionAbilityAvailabilityReason;
    ability?: AbilityDefinition;
    factionAbility?: FactionAbility;
    spec?: FactionAbilitySpec;
    cooldownRemaining?: number;
    unmetRequirements?: string[];
  };

function getFactionAbilityEntry(player: PlayerState, abilityId: string): FactionAbility | undefined {
  const faction = Object.values(FACTIONS).find(({ id }) => id === player.factionId);
  if (!faction) return undefined;

  return faction.abilities.find((factionAbility) =>
    normalizeAbility(factionAbility.id) === normalizeAbility(abilityId)
  );
}

function getRequirementFailures(player: PlayerState, ability: AbilityDefinition, spec?: FactionAbilitySpec): string[] {
  const requirements: FactionAbilityResourceCost | undefined = spec?.activationRequirement ?? ability.requirements;
  const unmet: string[] = [];

  if (requirements?.faith && player.stats.faith < requirements.faith) {
    unmet.push(`faith:${player.stats.faith}/${requirements.faith}`);
  }
  if (requirements?.pride && player.stats.pride < requirements.pride) {
    unmet.push(`pride:${player.stats.pride}/${requirements.pride}`);
  }
  if (requirements?.dissent && player.stats.internalDissent < requirements.dissent) {
    unmet.push(`dissent:${player.stats.internalDissent}/${requirements.dissent}`);
  }
  if (requirements?.stars && player.stars < requirements.stars) {
    unmet.push(`stars:${player.stars}/${requirements.stars}`);
  }

  return unmet;
}

export function getFactionAbilityAvailability(
  state: GameState,
  playerId: string,
  abilityId: string
): FactionAbilityAvailability {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { available: false, reason: "missing_player" };

  if (state.phase === "ended" || state.winner) {
    return { available: false, reason: "game_ended" };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer && currentPlayer.id !== player.id) {
    return { available: false, reason: "not_current_turn" };
  }

  const ability = ABILITIES[abilityId];
  if (!ability) return { available: false, reason: "unknown_ability" };

  if (ability.type !== "faction") {
    return { available: false, reason: "not_faction_ability", ability };
  }

  const factionAbility = getFactionAbilityEntry(player, abilityId);
  if (!factionAbility) {
    return { available: false, reason: "not_owned", ability };
  }

  if (factionAbility.type !== "active") {
    return {
      available: false,
      reason: factionAbility.type === "triggered" ? "triggered_only" : "passive_only",
      ability,
      factionAbility,
    };
  }

  const spec = getFactionAbilitySpec(abilityId);
  if (!spec) {
    return { available: false, reason: "missing_spec", ability, factionAbility };
  }

  if (spec.owningFaction !== player.factionId) {
    return { available: false, reason: "spec_owner_mismatch", ability, factionAbility, spec };
  }

  if (spec.status === "design_pending") {
    return { available: false, reason: "design_pending", ability, factionAbility, spec };
  }

  if (spec.status === "disabled") {
    return { available: false, reason: "disabled", ability, factionAbility, spec };
  }

  const cooldownRemaining = player.abilityCooldowns?.[abilityId] ?? 0;
  if (cooldownRemaining > 0) {
    return { available: false, reason: "cooldown", ability, factionAbility, spec, cooldownRemaining };
  }

  const unmetRequirements = getRequirementFailures(player, ability, spec);
  if (unmetRequirements.length > 0) {
    return { available: false, reason: "requirements", ability, factionAbility, spec, unmetRequirements };
  }

  if (spec.id === "MISSIONARY_ZEAL") {
    const selection = getTestimonyPressureSelection(state, player.id, spec.target.range ?? 4, {
      requireTargetVisibility: true,
    });
    if (selection.sourceUnits.length === 0) {
      return { available: false, reason: "no_valid_source", ability, factionAbility, spec };
    }
    if (selection.targetUnits.length === 0) {
      return { available: false, reason: "no_valid_targets", ability, factionAbility, spec };
    }
  }

  return { available: true, ability, factionAbility, spec };
}
