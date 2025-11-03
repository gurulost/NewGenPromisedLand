import { FACTIONS } from "./factions";

type AbilityScope = 'unit' | 'faction' | 'global';
type AbilityTarget = 'self' | 'ally' | 'enemy' | 'tile' | 'area' | 'global';

interface AbilityRequirements {
  faith?: number;
  pride?: number;
  dissent?: number;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: AbilityScope;
  effect: string;
  duration?: number;
  cooldown?: number;
  requirements?: AbilityRequirements;
  target?: AbilityTarget;
  isToggle?: boolean;
}

const abilityMap: Record<string, AbilityDefinition> = {
  // Core faction abilities
  TITLE_OF_LIBERTY: {
    id: 'TITLE_OF_LIBERTY',
    name: 'Title of Liberty',
    description: 'Raise Captain Moroni\'s banner to embolden allied units near your cities, granting them fortified strength for three turns.',
    type: 'faction',
    effect: 'TITLE_OF_LIBERTY',
    duration: 3,
    cooldown: 8,
    requirements: { faith: 70 },
    target: 'area',
  },
  RIGHTEOUS_DEFENSE: {
    id: 'RIGHTEOUS_DEFENSE',
    name: 'Righteous Defense',
    description: 'Sanctify your strongholds; covenant defenders within two tiles gain +2 defense and missionaries are healed.',
    type: 'faction',
    effect: 'RIGHTEOUS_DEFENSE',
    duration: 3,
    cooldown: 5,
    requirements: { faith: 20 },
    target: 'ally',
  },
  BLOOD_FEUD: {
    id: 'BLOOD_FEUD',
    name: 'Blood Feud',
    description: 'Fallen warriors kindle vengeance; nearby allies gain lasting attack power whenever a comrade falls.',
    type: 'faction',
    effect: 'BLOOD_FEUD',
    target: 'ally',
  },
  COVENANT_OF_PEACE: {
    id: 'COVENANT_OF_PEACE',
    name: 'Covenant of Peace',
    description: 'When enemies strike, respond with conversion attempts that erode their morale instead of bloodshed.',
    type: 'faction',
    effect: 'COVENANT_OF_PEACE',
    cooldown: 6,
    target: 'enemy',
  },
  RAMEUMPTOM: {
    id: 'RAMEUMPTOM',
    name: 'Rameumptom',
    description: 'Ascend the holy stand and double resource generation for five turns at the cost of mounting dissent.',
    type: 'faction',
    effect: 'RAMEUMPTOM',
    duration: 5,
    cooldown: 12,
    requirements: { pride: 70 },
    target: 'self',
  },
  MISSIONARY_ZEAL: {
    id: 'MISSIONARY_ZEAL',
    name: 'Missionary Zeal',
    description: 'Missionaries zealously convert wavering foes, restore faith, and calm dissent in nearby settlements.',
    type: 'faction',
    effect: 'MISSIONARY_ZEAL',
    cooldown: 5,
    requirements: { faith: 25 },
    target: 'area',
  },
  WARRIOR_RAGE: {
    id: 'WARRIOR_RAGE',
    name: 'Warrior Rage',
    description: 'Unleash ancestral fury to grant melee units +2 attack and +1 movement for two turns, at the cost of rising pride.',
    type: 'faction',
    effect: 'WARRIOR_RAGE',
    duration: 2,
    cooldown: 5,
    requirements: { pride: 20 },
    target: 'ally',
  },
  ANCIENT_KNOWLEDGE: {
    id: 'ANCIENT_KNOWLEDGE',
    name: 'Ancient Knowledge',
    description: 'Reveal hidden ruins and receive a surge of research drawn from the records of Zarahemla.',
    type: 'faction',
    effect: 'ANCIENT_KNOWLEDGE',
    cooldown: 6,
    requirements: { faith: 25 },
    target: 'global',
  },
  CULTURAL_RECLAMATION: {
    id: 'CULTURAL_RECLAMATION',
    name: 'Cultural Reclamation',
    description: 'Reclaim neutral settlements and erode foreign loyalty around your cities through inspired heritage.',
    type: 'faction',
    effect: 'CULTURAL_RECLAMATION',
    cooldown: 6,
    requirements: { faith: 18 },
    target: 'area',
  },
  WEALTH_ACCUMULATION: {
    id: 'WEALTH_ACCUMULATION',
    name: 'Wealth Accumulation',
    description: 'Toggle opulent displays: earn +1 star per city but lose faith and invite dissent each turn.',
    type: 'faction',
    effect: 'WEALTH_ACCUMULATION',
    cooldown: 3,
    isToggle: true,
    target: 'self',
  },
  ANCIENT_MIGHT: {
    id: 'ANCIENT_MIGHT',
    name: 'Ancient Might',
    description: 'Awaken Jaredite legions: grant +2 attack and +2 defense to allied units for three turns.',
    type: 'faction',
    effect: 'ANCIENT_MIGHT',
    duration: 3,
    cooldown: 6,
    requirements: { pride: 15, faith: 15 },
    target: 'ally',
  },
  PROPHETIC_COLLAPSE: {
    id: 'PROPHETIC_COLLAPSE',
    name: 'Prophetic Collapse',
    description: 'Sacrifice weaker hosts to forge a righteous remnant with heightened attack, defense, and faith.',
    type: 'faction',
    effect: 'PROPHETIC_COLLAPSE',
    cooldown: 12,
    target: 'self',
  },
  DIVINE_WARD: {
    id: 'DIVINE_WARD',
    name: 'Divine Ward',
    description: 'Grant an allied unit immunity to negative effects and refresh their vigor for three turns.',
    type: 'faction',
    effect: 'DIVINE_WARD',
    duration: 3,
    cooldown: 8,
    requirements: { faith: 10 },
    target: 'ally',
  },
  SPIRITUAL_WARFARE: {
    id: 'SPIRITUAL_WARFARE',
    name: 'Spiritual Warfare',
    description: 'Channel covenant power so that adjacent enemies lose faith each turn while your own faith grows.',
    type: 'faction',
    effect: 'SPIRITUAL_WARFARE',
    cooldown: 6,
    target: 'area',
  },
  RIGHTEOUS_FURY: {
    id: 'RIGHTEOUS_FURY',
    name: 'Righteous Fury',
    description: 'Channel the zeal of conversions--selected units grant nearby allies +3 attack for three turns.',
    type: 'faction',
    effect: 'RIGHTEOUS_FURY',
    duration: 3,
    cooldown: 6,
    target: 'ally',
  },
  FAITHFUL_RESISTANCE: {
    id: 'FAITHFUL_RESISTANCE',
    name: 'Faithful Resistance',
    description: 'Covenant disciples reduce the success of enemy conversion attempts by half.',
    type: 'faction',
    effect: 'FAITHFUL_RESISTANCE',
    target: 'self',
  },

  // Expanded faction ability set
  nephite_righteous_charge: {
    id: 'nephite_righteous_charge',
    name: 'Righteous Charge',
    description: 'Nephite frontline units gain a powerful strike when charging enemies within two tiles.',
    type: 'faction',
    effect: 'nephite_righteous_charge',
    cooldown: 3,
    target: 'enemy',
  },
  nephite_faith_healing: {
    id: 'nephite_faith_healing',
    name: 'Faith Healing',
    description: 'Missionaries call upon faith to heal allies within range and cleanse their fatigue.',
    type: 'faction',
    effect: 'nephite_faith_healing',
    cooldown: 4,
    requirements: { faith: 10 },
    target: 'area',
  },
  lamanite_guerrilla_tactics: {
    id: 'lamanite_guerrilla_tactics',
    name: 'Guerrilla Tactics',
    description: 'Hunters slip into the terrain, gaining defensive bonuses when ambushing from the wilds.',
    type: 'faction',
    effect: 'lamanite_guerrilla_tactics',
    cooldown: 3,
    target: 'self',
  },
  lamanite_ancestral_rage: {
    id: 'lamanite_ancestral_rage',
    name: 'Ancestral Rage',
    description: 'Invoke ancestral spirits to grant all Lamanite units an attack surge.',
    type: 'faction',
    effect: 'lamanite_ancestral_rage',
    cooldown: 5,
    requirements: { pride: 15 },
    target: 'ally',
  },
  zoramite_convert_enemy: {
    id: 'zoramite_convert_enemy',
    name: 'Prideful Conversion',
    description: 'Royal envoys attempt to sway an adjacent enemy through prideful sermons.',
    type: 'faction',
    effect: 'zoramite_convert_enemy',
    cooldown: 4,
    requirements: { pride: 20 },
    target: 'enemy',
  },
  zoramite_pride_boost: {
    id: 'zoramite_pride_boost',
    name: 'Pride Boost',
    description: 'Draw civic glory from each controlled city to swell your pride.',
    type: 'faction',
    effect: 'zoramite_pride_boost',
    cooldown: 4,
    target: 'self',
  },
  jaredite_tower_vision: {
    id: 'jaredite_tower_vision',
    name: 'Tower Vision',
    description: 'Reveal the wilderness around a chosen tile, expanding Jaredite cartography.',
    type: 'faction',
    effect: 'jaredite_tower_vision',
    cooldown: 6,
    requirements: { faith: 15 },
    target: 'tile',
  },
  jaredite_ancient_knowledge: {
    id: 'jaredite_ancient_knowledge',
    name: 'Ancestral Records',
    description: 'Unlock a forgotten technology from the Jaredite annals by expending faith.',
    type: 'faction',
    effect: 'jaredite_ancient_knowledge',
    cooldown: 8,
    requirements: { faith: 25 },
    target: 'self',
  },
  anti_nephi_lehi_pacify: {
    id: 'anti_nephi_lehi_pacify',
    name: 'Pacify',
    description: 'Reduce the attack strength of foes surrounding your peacekeepers.',
    type: 'faction',
    effect: 'anti_nephi_lehi_pacify',
    cooldown: 4,
    target: 'area',
  },
  anti_nephi_lehi_conversion: {
    id: 'anti_nephi_lehi_conversion',
    name: 'Peaceful Conversion',
    description: 'Spread faith through covenant promises, increasing faith while calming dissent.',
    type: 'faction',
    effect: 'anti_nephi_lehi_conversion',
    cooldown: 4,
    target: 'self',
  },
  mulekite_trade_network: {
    id: 'mulekite_trade_network',
    name: 'Trade Network',
    description: 'Gain stars from every city connected to your merchants within trade radius.',
    type: 'faction',
    effect: 'mulekite_trade_network',
    cooldown: 4,
    target: 'self',
  },
  mulekite_maritime_expansion: {
    id: 'mulekite_maritime_expansion',
    name: 'Maritime Expansion',
    description: 'Reveal coastlines and grant additional naval mobility for allied scouts.',
    type: 'faction',
    effect: 'mulekite_maritime_expansion',
    cooldown: 5,
    target: 'self',
  },

  // Unit abilities
  FAITHFUL_DEFENSE: {
    id: 'FAITHFUL_DEFENSE',
    name: 'Faithful Defense',
    description: 'Defense scales with the controlling player\'s faith, reinforcing covenant troops.',
    type: 'unit',
    effect: 'FAITHFUL_DEFENSE',
    target: 'self',
  },
  YOUNG_VIGOR: {
    id: 'YOUNG_VIGOR',
    name: 'Young Vigor',
    description: 'Stripling warriors ignore fear and regain movement when near collapse.',
    type: 'unit',
    effect: 'YOUNG_VIGOR',
    target: 'self',
  },
  DIPLOMACY: {
    id: 'DIPLOMACY',
    name: 'Diplomacy',
    description: 'Initiate negotiations to avoid combat or secure tribute from rivals.',
    type: 'unit',
    effect: 'DIPLOMACY',
    target: 'enemy',
  },
  CONVERT: {
    id: 'CONVERT',
    name: 'Convert',
    description: 'Attempt to peacefully convert an adjacent enemy unit.',
    type: 'unit',
    effect: 'CONVERT',
    target: 'enemy',
  },
  HEAL: {
    id: 'HEAL',
    name: 'Heal',
    description: 'Restore health to nearby allied units through ministering.',
    type: 'unit',
    effect: 'HEAL',
    target: 'ally',
  },
  FORTIFY: {
    id: 'FORTIFY',
    name: 'Fortify',
    description: 'Entrench and double defense at the cost of movement.',
    type: 'unit',
    effect: 'FORTIFY',
    target: 'self',
  },
  STEALTH: {
    id: 'STEALTH',
    name: 'Stealth',
    description: 'Hide from enemy vision unless adjacent.',
    type: 'unit',
    effect: 'STEALTH',
    target: 'self',
  },
  LEADERSHIP: {
    id: 'LEADERSHIP',
    name: 'Leadership',
    description: 'Provide a morale aura that grants nearby units balanced stat bonuses.',
    type: 'unit',
    effect: 'LEADERSHIP',
    target: 'ally',
  },
  PROTECTIVE_STANCE: {
    id: 'PROTECTIVE_STANCE',
    name: 'Protective Stance',
    description: 'Guards brace to shield adjacent allies, absorbing part of incoming damage.',
    type: 'unit',
    effect: 'PROTECTIVE_STANCE',
    target: 'ally',
  },
  RALLY_TROOPS: {
    id: 'RALLY_TROOPS',
    name: 'Rally Troops',
    description: 'Commanders rally nearby allies, granting attack and movement bonuses.',
    type: 'unit',
    effect: 'RALLY_TROOPS',
    target: 'ally',
  },
  NAVAL_COMMAND: {
    id: 'NAVAL_COMMAND',
    name: 'Naval Command',
    description: 'Commanders extend movement and attack bonuses to adjacent naval units.',
    type: 'unit',
    effect: 'NAVAL_COMMAND',
    target: 'ally',
  },
  FORMATION_FIGHTING: {
    id: 'FORMATION_FIGHTING',
    name: 'Formation Fighting',
    description: 'Spearmen gain defense when standing shoulder-to-shoulder with allies.',
    type: 'unit',
    effect: 'FORMATION_FIGHTING',
    target: 'ally',
  },
  NAVAL_TRANSPORT: {
    id: 'NAVAL_TRANSPORT',
    name: 'Naval Transport',
    description: 'Boats can ferry land units and traverse rivers efficiently.',
    type: 'unit',
    effect: 'NAVAL_TRANSPORT',
    target: 'ally',
  },
  COASTAL_EXPLORATION: {
    id: 'COASTAL_EXPLORATION',
    name: 'Coastal Exploration',
    description: 'Reveal coastline tiles while sailing, improving map awareness.',
    type: 'unit',
    effect: 'COASTAL_EXPLORATION',
    target: 'tile',
  },
  SIEGE: {
    id: 'SIEGE',
    name: 'Siege Mode',
    description: 'Deploy siege engines to bombard cities from range.',
    type: 'unit',
    effect: 'SIEGE',
    target: 'enemy',
  },
  INTELLIGENCE: {
    id: 'INTELLIGENCE',
    name: 'Gather Intelligence',
    description: 'Royal envoys provide insight into enemy research and expose hidden tiles.',
    type: 'unit',
    effect: 'INTELLIGENCE',
    target: 'enemy',
  },
  FOREST_STEALTH: {
    id: 'FOREST_STEALTH',
    name: 'Forest Stealth',
    description: 'Blend into forests, becoming stealthed while remaining among the trees.',
    type: 'unit',
    effect: 'FOREST_STEALTH',
    target: 'self',
  },
  AMBUSH: {
    id: 'AMBUSH',
    name: 'Ambush',
    description: 'Deliver a sudden first strike with bonus damage when attacking from concealment.',
    type: 'unit',
    effect: 'AMBUSH',
    target: 'enemy',
  },
  RANGED_ATTACK: {
    id: 'RANGED_ATTACK',
    name: 'Ranged Attack',
    description: 'Fire on foes from two tiles away, provided the line of sight is clear.',
    type: 'unit',
    effect: 'RANGED_ATTACK',
    target: 'enemy',
  },
  GIANT_STRENGTH: {
    id: 'GIANT_STRENGTH',
    name: 'Giant Strength',
    description: 'Ancient giants wield overwhelming melee power, ignoring most fortifications.',
    type: 'unit',
    effect: 'GIANT_STRENGTH',
    target: 'enemy',
  },
  INTIMIDATE: {
    id: 'INTIMIDATE',
    name: 'Intimidate',
    description: 'Reduce nearby enemy morale and combat readiness through sheer presence.',
    type: 'unit',
    effect: 'INTIMIDATE',
    target: 'area',
  },
  SIEGE_BREAKER: {
    id: 'SIEGE_BREAKER',
    name: 'Siege Breaker',
    description: 'Special attacks that tear down city defenses and walls.',
    type: 'unit',
    effect: 'SIEGE_BREAKER',
    target: 'enemy',
  },
  PACIFIST_DEFENSE: {
    id: 'PACIFIST_DEFENSE',
    name: 'Pacifist Defense',
    description: 'Anti-Nephi-Lehi guards convert aggression into defense rather than retaliation.',
    type: 'unit',
    effect: 'PACIFIST_DEFENSE',
    target: 'self',
  },
  PROTECTIVE_AURA: {
    id: 'PROTECTIVE_AURA',
    name: 'Protective Aura',
    description: 'Allies adjacent to peacekeepers take reduced damage from enemy attacks.',
    type: 'unit',
    effect: 'PROTECTIVE_AURA',
    target: 'ally',
  },
  NON_VIOLENCE: {
    id: 'NON_VIOLENCE',
    name: 'Non-Violence',
    description: 'Peacekeepers refuse offensive actions, lowering pride but inspiring faith.',
    type: 'unit',
    effect: 'NON_VIOLENCE',
    target: 'self',
  },
  RECONNAISSANCE: {
    id: 'RECONNAISSANCE',
    name: 'Reconnaissance',
    description: 'Scouts reveal a wide area, identifying hidden threats and resources.',
    type: 'unit',
    effect: 'RECONNAISSANCE',
    target: 'tile',
  },
  BUILD: {
    id: 'BUILD',
    name: 'Build Improvement',
    description: 'Construct improvements to harvest additional yields from the land.',
    type: 'unit',
    effect: 'BUILD',
    target: 'tile',
  },
  HARVEST: {
    id: 'HARVEST',
    name: 'Harvest Resource',
    description: 'Gather raw resources from the current tile.',
    type: 'unit',
    effect: 'HARVEST',
    target: 'tile',
  },
  CLEAR_FOREST: {
    id: 'CLEAR_FOREST',
    name: 'Clear Forest',
    description: 'Remove forest to make room for development while gaining immediate resources.',
    type: 'unit',
    effect: 'CLEAR_FOREST',
    target: 'tile',
  },
  BUILD_ROAD: {
    id: 'BUILD_ROAD',
    name: 'Build Road',
    description: 'Lay down roads to speed travel and commerce.',
    type: 'unit',
    effect: 'BUILD_ROAD',
    target: 'tile',
  },

  // Technology unlocked abilities (retain lowercase keys for compatibility)
  blessing: {
    id: 'blessing',
    name: 'Blessing',
    description: 'Provide divine protection and healing to nearby allied units.',
    type: 'unit',
    effect: 'blessing',
    requirements: { faith: 30 },
    target: 'ally',
  },
  conversion: {
    id: 'conversion',
    name: 'Conversion',
    description: 'Convert enemy units to your side through faith.',
    type: 'unit',
    effect: 'conversion',
    requirements: { faith: 50 },
    target: 'enemy',
  },
  divine_protection: {
    id: 'divine_protection',
    name: 'Divine Protection',
    description: 'Reduce all incoming damage by half for two turns.',
    type: 'unit',
    effect: 'divine_protection',
    duration: 2,
    cooldown: 5,
    requirements: { faith: 60 },
    target: 'ally',
  },
  enlightenment: {
    id: 'enlightenment',
    name: 'Enlightenment',
    description: 'Instantly learn a technology for which you qualify.',
    type: 'global',
    effect: 'enlightenment',
    cooldown: 20,
    requirements: { faith: 80 },
    target: 'global',
  },
};

const registerAbilityAlias = (canonicalId: string, ...aliases: string[]) => {
  const canonical = abilityMap[canonicalId];
  if (!canonical) return;
  aliases.forEach(alias => {
    if (!alias || alias === canonicalId) return;
    if (!abilityMap[alias]) {
      abilityMap[alias] = {
        ...canonical,
        id: alias,
      };
    }
  });
};

const aliasGroups: Record<string, string[]> = {
  HEAL: ['heal'],
  CONVERT: ['convert'],
  STEALTH: ['stealth'],
  LEADERSHIP: ['leadership'],
  FORTIFY: ['fortify'],
  FAITHFUL_DEFENSE: ['faithful_defense'],
  YOUNG_VIGOR: ['young_vigor'],
  PROTECTIVE_STANCE: ['protective_stance'],
  RALLY_TROOPS: ['rally_troops'],
  NAVAL_COMMAND: ['naval_command'],
  FORMATION_FIGHTING: ['formation_fighting'],
  NAVAL_TRANSPORT: ['naval_transport'],
  COASTAL_EXPLORATION: ['coastal_exploration'],
  SIEGE: ['siege'],
  DIPLOMACY: ['diplomacy'],
  INTELLIGENCE: ['intelligence'],
  FOREST_STEALTH: ['forest_stealth'],
  AMBUSH: ['ambush'],
  RANGED_ATTACK: ['ranged_attack'],
  GIANT_STRENGTH: ['giant_strength'],
  INTIMIDATE: ['intimidate'],
  SIEGE_BREAKER: ['siege_breaker'],
  PACIFIST_DEFENSE: ['pacifist_defense'],
  PROTECTIVE_AURA: ['protective_aura'],
  NON_VIOLENCE: ['non_violence'],
  RECONNAISSANCE: ['reconnaissance'],
  BUILD: ['build'],
  HARVEST: ['harvest'],
  CLEAR_FOREST: ['clear_forest'],
  BUILD_ROAD: ['build_road'],
  MISSIONARY_ZEAL: ['missionary_zeal'],
  WARRIOR_RAGE: ['warrior_rage'],
  ANCIENT_MIGHT: ['ancient_might'],
};

Object.entries(aliasGroups).forEach(([canonical, aliases]) => {
  registerAbilityAlias(canonical, ...aliases);
  registerAbilityAlias(canonical, canonical.toLowerCase());
});

export const ABILITIES = abilityMap;

export const getAbility = (id: string): AbilityDefinition | undefined => {
  return ABILITIES[id];
};

export const getFactionAbilities = (factionId: string): AbilityDefinition[] => {
  const faction = Object.values(FACTIONS).find(f => f.id === factionId);
  if (!faction) return [];

  return faction.abilities.map(ability => {
    const base = ABILITIES[ability.id];
    if (base) {
      return {
        ...base,
        id: ability.id,
        name: ability.name ?? base.name,
        description: ability.description ?? base.description,
        cooldown: ability.cooldown ?? base.cooldown,
        requirements: ability.requirements ?? base.requirements,
      };
    }

    return {
      id: ability.id,
      name: ability.name,
      description: ability.description,
      type: 'faction',
      effect: ability.id,
      cooldown: ability.cooldown,
      requirements: ability.requirements,
    };
  });
};
