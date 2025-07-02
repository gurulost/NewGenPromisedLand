import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import type { PlayerState } from "@shared/types/game";
import type { Faction } from "@shared/types/faction";

interface AbilitiesPanelProps {
  player: PlayerState;
  faction: Faction;
  onUseAbility: (abilityId: string) => void;
}

export default function AbilitiesPanel({ player, faction, onUseAbility }: AbilitiesPanelProps) {
  // Simple implementation for now - can be expanded later
  const availableAbilities = faction.abilities || [];

  if (availableAbilities.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 pointer-events-auto">
      <Card className="w-64 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white">Faction Abilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {availableAbilities.map(ability => (
            <Button
              key={ability.id}
              variant="outline"
              size="sm"
              className="w-full justify-start bg-purple-600/20 border-purple-400 text-purple-100 hover:bg-purple-600/40"
              onClick={() => onUseAbility(ability.id)}
            >
              <div className="text-left">
                <div className="font-medium">{ability.name}</div>
                <div className="text-xs text-purple-200">{ability.description}</div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}