import React from 'react';
import { CombatEffects, useCombatEffects } from './CombatEffects';

export function CombatEffectsDemo() {
  const {
    damageNumbers,
    effects,
    removeEffect,
    triggerBattleSequence,
    triggerSpellEffect,
    triggerLevelUp,
    triggerDefensiveAction,
    triggerMassBattle
  } = useCombatEffects();

  const demoAttacker = { x: 200, y: 300, unitType: 'warrior' };
  const demoDefender = { x: 400, y: 300, unitType: 'scout' };

  const handleMeleeBattle = () => {
    triggerBattleSequence(demoAttacker, demoDefender, 18, 'melee');
  };

  const handleRangedBattle = () => {
    triggerBattleSequence(demoAttacker, demoDefender, 12, 'ranged');
  };

  const handleMagicBattle = () => {
    triggerBattleSequence(demoAttacker, demoDefender, 22, 'magic');
  };

  const handleSiegeBattle = () => {
    triggerBattleSequence(demoAttacker, demoDefender, 25, 'siege');
  };

  const handleHealSpell = () => {
    triggerSpellEffect(
      { x: 200, y: 200 },
      { x: 300, y: 200 },
      'heal'
    );
  };

  const handleLevelUpEffect = () => {
    triggerLevelUp({ x: 350, y: 250 });
  };

  const handleDefenseAction = () => {
    triggerDefensiveAction({ x: 400, y: 250 }, 'block');
  };

  const handleMassBattle = () => {
    const participants = [
      { x: 150, y: 200, unitType: 'warrior' },
      { x: 250, y: 180, unitType: 'spearman' },
      { x: 180, y: 250, unitType: 'commander' },
      { x: 350, y: 220, unitType: 'scout' }
    ];
    triggerMassBattle({ x: 300, y: 300 }, participants);
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      {/* Demo Battle Arena */}
      <div className="absolute inset-0">
        <CombatEffects
          damageNumbers={damageNumbers}
          effects={effects}
          onEffectComplete={removeEffect}
        />
      </div>

      {/* Demo Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 rounded-lg p-4 backdrop-blur-sm">
        <h3 className="text-xl font-bold text-white mb-4">🎬 Battle Animation Demo</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleMeleeBattle}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
          >
            ⚔️ Melee Combat
          </button>
          
          <button
            onClick={handleRangedBattle}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
          >
            🏹 Ranged Attack
          </button>
          
          <button
            onClick={handleMagicBattle}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors"
          >
            🔮 Magic Spell
          </button>
          
          <button
            onClick={handleSiegeBattle}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md font-medium transition-colors"
          >
            💥 Siege Warfare
          </button>
          
          <button
            onClick={handleHealSpell}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
          >
            ✨ Healing Magic
          </button>
          
          <button
            onClick={handleLevelUpEffect}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium transition-colors"
          >
            ⭐ Level Up!
          </button>
          
          <button
            onClick={handleDefenseAction}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-medium transition-colors"
          >
            🛡️ Block/Defend
          </button>
          
          <button
            onClick={handleMassBattle}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
          >
            ⚡ Epic Battle
          </button>
        </div>
      </div>

      {/* Battle Arena Indicators */}
      <div className="absolute" style={{ left: 200, top: 300 }}>
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
          A
        </div>
        <div className="text-xs text-white mt-1 text-center">Attacker</div>
      </div>
      
      <div className="absolute" style={{ left: 400, top: 300 }}>
        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
          D
        </div>
        <div className="text-xs text-white mt-1 text-center">Defender</div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-black/80 rounded-lg p-4 backdrop-blur-sm max-w-xs">
        <h4 className="text-lg font-semibold text-white mb-2">✨ Enhanced Combat System</h4>
        <p className="text-sm text-gray-300">
          Experience cinematic battle animations with dramatic charge attacks, 
          explosive impacts, magical effects, and enhanced damage displays. 
          Each combat type has unique visual sequences and timing.
        </p>
      </div>
    </div>
  );
}