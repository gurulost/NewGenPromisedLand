export type TutorialCardId =
  | 'overview'
  | 'hud'
  | 'city'
  | 'tech'
  | 'movement'
  | 'world-elements'
  | 'village'
  | 'combat'
  | 'end-turn'
  | 'victory';

export interface TutorialCard {
  id: TutorialCardId;
  title: string;
  lore: string;
  bullets: string[];
  tryIt: string;
  summary: string;
  primaryActionLabel?: string;
}

export const TUTORIAL_CARD_ORDER: TutorialCardId[] = [
  'overview',
  'hud',
  'city',
  'tech',
  'movement',
  'world-elements',
  'village',
  'combat',
  'end-turn',
  'victory',
];

export const TUTORIAL_CARDS: Record<TutorialCardId, TutorialCard> = {
  overview: {
    id: 'overview',
    title: 'Chronicles of the Promised Land',
    lore: 'You have led your people into the Promised Land. Prosperity will test your covenant. Grow wisely, or pride will unmake what faith has built.',
    bullets: [
      'You lead a people: grow, survive, and endure.',
      'Win by Faith, economy, culture, territory, or score.',
      'Each turn: move -> act -> spend Stars -> end turn.',
    ],
    tryIt: 'Open the HUD to see Stars, Faith, Pride, and Dissent.',
    summary: 'What this game is and how a turn works.',
    primaryActionLabel: 'Begin',
  },
  hud: {
    id: 'hud',
    title: 'Stewardship of Your People',
    lore: 'Stewardship begins with clarity -- know the state of your people.',
    bullets: [
      'Stars are your economy: research, build, and recruit.',
      'Faith is power and stability; Pride and Dissent are risks.',
      'Victory progress shows how close you are to each path.',
    ],
    tryIt: 'Use Build or Tech to turn Stars into long-term strength.',
    summary: 'Stars, Faith, Pride/Dissent, and victory progress.',
  },
  city: {
    id: 'city',
    title: 'Cities Build Your Future',
    lore: "A city's strength is built one choice at a time.",
    bullets: [
      'Recruit units, build structures, and grow population.',
      'City capacity limits how many units can stand inside.',
      'Structures and improvements raise Stars and Faith over time.',
    ],
    tryIt: 'Recruit a Worker or build a structure.',
    summary: 'Recruit, build, and grow population.',
  },
  tech: {
    id: 'tech',
    title: 'Sacred Knowledge',
    lore: 'Records preserve a people -- and unlock their future.',
    bullets: [
      'Research unlocks units, improvements, and structures.',
      'Tech costs scale as you advance -- choose a focus.',
      'Select a tech to see its unlocks and costs.',
    ],
    tryIt: 'Research a Tier 1 tech to open early options.',
    summary: 'Unlocks and research cost scaling.',
  },
  movement: {
    id: 'movement',
    title: 'Exploration & Movement',
    lore: "Scouts tread into unknown lands to find the Lord's provisions.",
    bullets: [
      'Movement reveals the map and uncovers resources.',
      'Terrain changes movement cost and combat defense.',
      'Explored terrain remains dimmed as memory; only current sight is fully visible.',
    ],
    tryIt: 'Move a unit toward the edge of the fog.',
    summary: 'Explore, reveal, and respect terrain.',
  },
  'world-elements': {
    id: 'world-elements',
    title: 'Stewardship of the Land',
    lore: 'Every resource offers a test: take now, or build for later.',
    bullets: [
      'Immediate harvest brings quick gains but raises Pride/Dissent.',
      'Long-term builds grow Faith and steady income.',
      'Some actions require specific units or tech.',
    ],
    tryIt: 'Compare the two choices before you act.',
    summary: 'Harvest now vs build for later.',
  },
  village: {
    id: 'village',
    title: 'Gathering the People',
    lore: 'How you gather your people shapes their hearts.',
    bullets: [
      'Conquer: immediate Stars and population, but Pride/Dissent rise.',
      'Convert: slower now, steady income later, Faith impact.',
      'Population rewards go to your nearest city.',
    ],
    tryIt: 'Choose the path that fits your strategy.',
    summary: 'Conquer vs convert tradeoffs.',
  },
  combat: {
    id: 'combat',
    title: 'Wise Defense',
    lore: 'Defend with wisdom, not only strength.',
    bullets: [
      'Attack vs Defense decides damage; terrain favors defenders.',
      'Ranged attacks follow distance rules and can be countered.',
      'Faith bonuses can swing battles.',
    ],
    tryIt: 'Check terrain before committing to a fight.',
    summary: 'Combat basics and terrain impact.',
  },
  'end-turn': {
    id: 'end-turn',
    title: 'The Cycle Turns',
    lore: 'The cycle turns; prosperity or contention follows.',
    bullets: [
      'Income applies and cooldowns tick.',
      'Pride and Dissent shift; events can trigger.',
      "End turns only when you're ready to commit actions.",
    ],
    tryIt: 'End the turn and watch resources update.',
    summary: 'What happens when a turn ends.',
  },
  victory: {
    id: 'victory',
    title: 'Paths to Victory',
    lore: 'Many paths, one record.',
    bullets: [
      'Faith: high Faith with low Dissent.',
      'Economic: strong income, treasury, and tech.',
      'Cultural/Territory/Score: grow people, sites, and cities.',
    ],
    tryIt: 'Pick one path to prioritize this game.',
    summary: 'The win conditions and how to track them.',
  },
};

export function getTutorialCard(id: TutorialCardId | null): TutorialCard | null {
  if (!id) return null;
  return TUTORIAL_CARDS[id] ?? null;
}
