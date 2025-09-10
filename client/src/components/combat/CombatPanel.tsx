import React, { useMemo } from 'react';
import { Sword, Shield, Heart, Target } from 'lucide-react';

import { HUDShell } from '../primitives/HUDShell';
import { GlowingButton } from '../primitives/GlowingButton';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

import { Unit } from '@shared/types/unit';
import { getCombatOdds, CombatOdds } from '../../selectors/combat';

interface CombatPanelProps {
  attacker: Unit;
  defenders: Unit[];
  onAttack: (defenderId: string) => void;
  onCancel: () => void;
}

export function CombatPanel({ attacker, defenders, onAttack, onCancel }: CombatPanelProps) {
  return (
    <HUDShell position="bottom-right">
      <Card className="w-80 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 
                     border-2 border-red-500/30 shadow-2xl shadow-red-500/20 backdrop-blur-sm">
        <CardHeader className="pb-3 bg-gradient-to-r from-red-900/20 to-red-800/20 border-b border-red-500/20">
          <CardTitle className="flex items-center gap-3 text-red-100 font-cinzel text-lg font-semibold tracking-wide">
            <Sword className="w-5 h-5 text-red-400" />
            Combat
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 bg-slate-900/40 p-4">
          {/* Attacker Info */}
          <AttackerSection unit={attacker} />
          
          {/* Enemy List */}
          <EnemyList 
            enemies={defenders}
            attacker={attacker}
            onAttack={onAttack}
          />
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <GlowingButton
              variant="destructive"
              size="sm"
              glowColor="red"
              intensity="high"
              className="flex-1"
              onClick={onCancel}
              soundEffect="panel-close"
            >
              Cancel Attack
            </GlowingButton>
          </div>
        </CardContent>
      </Card>
    </HUDShell>
  );
}

const AttackerSection = React.memo(({ unit }: { unit: Unit }) => (
  <div className="rounded-lg bg-slate-800/30 p-3 border border-amber-500/20">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-slate-900">{unit.name[0]}</span>
      </div>
      <div>
        <h4 className="font-cinzel font-semibold text-amber-200">{unit.name}</h4>
        <p className="text-xs text-amber-300/70">Your {unit.type}</p>
      </div>
    </div>
    
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="text-center">
        <div className="text-red-300 font-semibold flex items-center justify-center gap-1">
          <Sword className="w-3 h-3" />
          {unit.combat.attack}
        </div>
        <div className="text-amber-300/60">Attack</div>
      </div>
      <div className="text-center">
        <div className="text-blue-300 font-semibold flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          {unit.combat.defense}
        </div>
        <div className="text-amber-300/60">Defense</div>
      </div>
      <div className="text-center">
        <div className="text-green-300 font-semibold flex items-center justify-center gap-1">
          <Heart className="w-3 h-3" />
          {unit.health}/{unit.maxHealth}
        </div>
        <div className="text-amber-300/60">Health</div>
      </div>
    </div>
  </div>
));

const EnemyList = React.memo(({ enemies, attacker, onAttack }: {
  enemies: Unit[];
  attacker: Unit;
  onAttack: (defenderId: string) => void;
}) => (
  <div className="space-y-2">
    <h4 className="font-cinzel font-semibold text-red-200 flex items-center gap-2">
      <Target className="w-4 h-4" />
      Select Target
    </h4>
    
    <div className="max-h-60 overflow-y-auto space-y-2">
      {enemies.map(enemy => (
        <EnemyCard 
          key={enemy.id}
          enemy={enemy}
          attacker={attacker}
          onAttack={onAttack}
        />
      ))}
    </div>
  </div>
));

const EnemyCard = React.memo(({ enemy, attacker, onAttack }: {
  enemy: Unit;
  attacker: Unit;
  onAttack: (defenderId: string) => void;  
}) => {
  const combatOdds = useMemo(() => 
    getCombatOdds(attacker, enemy), 
    [attacker, enemy]
  );
  
  return (
    <div 
      className="rounded-lg bg-slate-800/40 p-3 border border-red-500/30 hover:border-red-400/50 
                 transition-all cursor-pointer group"
      onClick={() => onAttack(enemy.id)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">{enemy.name[0]}</span>
          </div>
          <div>
            <h5 className="font-medium text-red-200">{enemy.name}</h5>
            <p className="text-xs text-red-300/70">{enemy.type}</p>
          </div>
        </div>
        
        <CombatOddsDisplay odds={combatOdds} />
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="text-red-300 font-semibold">{enemy.combat.attack}</div>
          <div className="text-amber-300/60">ATK</div>
        </div>
        <div className="text-center">
          <div className="text-blue-300 font-semibold">{enemy.combat.defense}</div>
          <div className="text-amber-300/60">DEF</div>
        </div>
        <div className="text-center">
          <div className="text-green-300 font-semibold">{enemy.health}/{enemy.maxHealth}</div>
          <div className="text-amber-300/60">HP</div>
        </div>
      </div>
    </div>
  );
});

const CombatOddsDisplay = React.memo(({ odds }: { odds: CombatOdds }) => {
  const getOddsColor = (winChance: number) => {
    if (winChance >= 75) return 'text-green-300';
    if (winChance >= 50) return 'text-yellow-300';
    if (winChance >= 25) return 'text-orange-300';
    return 'text-red-300';
  };
  
  return (
    <div className="text-right text-xs">
      <div className={`font-semibold ${getOddsColor(odds.attackerWinChance)}`}>
        {Math.round(odds.attackerWinChance)}%
      </div>
      <div className="text-amber-300/60">Win</div>
    </div>
  );
});