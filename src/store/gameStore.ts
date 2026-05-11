import { reactive } from 'vue';

export type Race = 'Human' | 'Elven' | 'Dwarf' | 'Orc';
export type Resource = 'Food' | 'Gold' | 'Mana' | 'Wood' | 'Iron';
export type WorkerType = 'basic' | 'panda';

export interface WorkerState {
  basic: number;
  panda: number;
}

export interface GameState {
  player: {
    name: string;
    race: Race | null;
    startingResources: Resource[];
    unlockedResources: Resource[];
    actionPoints: number;
    maxActionPoints: number;
    spies: number;
  };
  province: {
    acres: number;
    population: number;
  };
  military: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  buildings: Record<Resource | 'Barracks' | 'Housing' | 'Tavern', number>;
  resources: Record<Resource, number>;
  workers: Record<Resource, WorkerState>;
  phase: 'CREATION_RACE' | 'CREATION_RESOURCES' | 'GAMEPLAY';
  lastTick: number;
  apAccumulator: number;
  research: string[];
  heroes: string[];
}

export type HeroRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Hero {
  id: string;
  name: string;
  icon: string;
  rarity: HeroRarity;
  cost: { Gold: number; Mana?: number };
  description: string;
  prereqs?: { tavernLevel?: number; research?: string[] };
}

export type ResearchBranch = 'military' | 'economy' | 'civic' | 'construction' | 'espionage' | 'magic';

export interface Research {
  id: string;
  name: string;
  branch: ResearchBranch;
  tier: number;
  slot: number;
  cost: { Gold?: number; Mana?: number };
  prereqs: string[];
  description: string;
}

const initialState: GameState = {
  player: {
    name: 'Player',
    race: null,
    startingResources: [],
    unlockedResources: [],
    actionPoints: 100,
    maxActionPoints: 100,
    spies: 0,
  },
  province: {
    acres: 100,
    population: 100,
  },
  military: {
    tier1: 0,
    tier2: 0,
    tier3: 0,
  },
  buildings: {
    Food: 1,
    Gold: 1,
    Mana: 1,
    Wood: 1,
    Iron: 1,
    Barracks: 1,
    Housing: 10,
    Tavern: 1,
  },
  resources: {
    Food: 500,
    Gold: 1000,
    Mana: 100,
    Wood: 500,
    Iron: 150,
  },
  workers: {
    Food: { basic: 0, panda: 0 },
    Gold: { basic: 0, panda: 0 },
    Mana: { basic: 0, panda: 0 },
    Wood: { basic: 0, panda: 0 },
    Iron: { basic: 0, panda: 0 },
  },
  phase: 'CREATION_RACE',
  lastTick: Date.now(),
  apAccumulator: 0,
  research: [],
  heroes: [],
};

export const store = reactive<GameState>(initialState);

export const TROOP_CONFIG = {
  Human: { tier1: { attack: 3, defense: 3 }, tier2: { attack: 6, defense: 6 }, tier3: { attack: 9, defense: 9 } },
  Elven: { tier1: { attack: 2, defense: 4 }, tier2: { attack: 4, defense: 7 }, tier3: { attack: 6, defense: 10 } },
  Dwarf: { tier1: { attack: 4, defense: 2 }, tier2: { attack: 7, defense: 4 }, tier3: { attack: 10, defense: 6 } },
  Orc: { tier1: { attack: 4, defense: 4 }, tier2: { attack: 8, defense: 8 }, tier3: { attack: 12, defense: 12 } }
};

export const TRAINING_COSTS = {
  tier1: { Gold: 100, Food: 50, Iron: 20 },
  promote: { Gold: 200, Food: 100, Iron: 50 }
};

export const buildingCost = (level: number) => {
  const amount = 100 * 2 ** Math.max(0, level - 1);
  return { Gold: amount, Wood: amount };
};

export const BUILDING_LAND: Record<Resource | 'Barracks' | 'Housing' | 'Tavern', number> = {
  Food: 5, Wood: 2, Iron: 1, Gold: 1, Mana: 0,
  Housing: 1, Barracks: 1, Tavern: 2,
};

export const TAVERN_NAMES = [
  '',
  'Wayside Hovel',
  'Roadside Inn',
  'Crossroads Tavern',
  'Bustling Lodge',
  'Grand Public House',
  'Royal Inn',
  'Hall of Heroes',
  'Legendary Sanctum',
];
export const TAVERN_MAX_LEVEL = 8;

export const landUsed = () => {
  let total = 0;
  for (const key of Object.keys(BUILDING_LAND) as (keyof typeof BUILDING_LAND)[]) {
    total += effectiveBuildingLand(key) * store.buildings[key];
  }
  return total;
};

export const RESEARCH: Record<string, Research> = {
  // ── Military ──────────────────────────────────────────────────────────
  iron_weapons:    { id: 'iron_weapons',    name: 'Iron Weapons',    branch: 'military', tier: 1, slot: 1, cost: { Gold:   500 }, prereqs: [], description: 'Tier 1 attack +1' },
  steel_weapons:   { id: 'steel_weapons',   name: 'Steel Weapons',   branch: 'military', tier: 2, slot: 1, cost: { Gold:  1500 }, prereqs: ['iron_weapons'], description: 'Tier 1 attack +2, Tier 2 attack +1' },
  forged_blades:   { id: 'forged_blades',   name: 'Forged Blades',   branch: 'military', tier: 3, slot: 1, cost: { Gold:  4000 }, prereqs: ['steel_weapons'], description: 'Tier 2 attack +2, Tier 3 attack +1' },
  master_smithing: { id: 'master_smithing', name: 'Master Smithing', branch: 'military', tier: 4, slot: 1, cost: { Gold: 10000 }, prereqs: ['forged_blades', 'mining'], description: 'Tier 3 attack +3 (also requires Mining)' },
  leather_armor:   { id: 'leather_armor',   name: 'Leather Armor',   branch: 'military', tier: 1, slot: 2, cost: { Gold:   500 }, prereqs: [], description: 'Tier 1 defense +1' },
  chain_mail:      { id: 'chain_mail',      name: 'Chain Mail',      branch: 'military', tier: 2, slot: 2, cost: { Gold:  1500 }, prereqs: ['leather_armor'], description: 'Tier 1 def +2, Tier 2 def +1' },
  plate_armor:     { id: 'plate_armor',     name: 'Plate Armor',     branch: 'military', tier: 3, slot: 2, cost: { Gold:  4000 }, prereqs: ['chain_mail'], description: 'Tier 2 def +2, Tier 3 def +1' },
  tempered_steel:  { id: 'tempered_steel',  name: 'Tempered Steel',  branch: 'military', tier: 4, slot: 2, cost: { Gold: 10000 }, prereqs: ['plate_armor', 'mining'], description: 'Tier 3 def +3 (also requires Mining)' },
  drill:           { id: 'drill',           name: 'Drill',           branch: 'military', tier: 1, slot: 3, cost: { Gold:  1000 }, prereqs: [], description: 'Troops consume 25% less Food' },
  quartermaster:   { id: 'quartermaster',   name: 'Quartermaster',   branch: 'military', tier: 2, slot: 3, cost: { Gold:  3000 }, prereqs: ['drill'], description: 'Troop Gold maintenance −25%' },
  war_banners:     { id: 'war_banners',     name: 'War Banners',     branch: 'military', tier: 3, slot: 3, cost: { Gold:  8000 }, prereqs: ['quartermaster'], description: 'Conquest gains +50% acres' },

  // ── Economy ──────────────────────────────────────────────────────────
  agriculture:           { id: 'agriculture',           name: 'Agriculture',           branch: 'economy', tier: 1, slot: 1, cost: { Gold:   500 }, prereqs: [], description: 'Food production +25%' },
  forestry:              { id: 'forestry',              name: 'Forestry',              branch: 'economy', tier: 1, slot: 2, cost: { Gold:   500 }, prereqs: [], description: 'Wood production +25%' },
  mining:                { id: 'mining',                name: 'Mining',                branch: 'economy', tier: 1, slot: 3, cost: { Gold:   500 }, prereqs: [], description: 'Iron and Gold production +25%' },
  crop_rotation:         { id: 'crop_rotation',         name: 'Crop Rotation',         branch: 'economy', tier: 2, slot: 1, cost: { Gold:  2000 }, prereqs: ['agriculture'], description: 'Food +50% (stacks → +75%)' },
  lumber_mill:           { id: 'lumber_mill',           name: 'Lumber Mill',           branch: 'economy', tier: 2, slot: 2, cost: { Gold:  2000 }, prereqs: ['forestry'], description: 'Wood +50% (stacks → +75%)' },
  deep_shafts:           { id: 'deep_shafts',           name: 'Deep Shafts',           branch: 'economy', tier: 2, slot: 3, cost: { Gold:  2000 }, prereqs: ['mining'], description: 'Iron + Gold +50% (stacks)' },
  industrial_revolution: { id: 'industrial_revolution', name: 'Industrial Revolution', branch: 'economy', tier: 3, slot: 2, cost: { Gold:  8000 }, prereqs: ['crop_rotation', 'lumber_mill', 'deep_shafts'], description: 'All resource production +25% (multiplicative)' },
  banking:               { id: 'banking',               name: 'Banking',               branch: 'economy', tier: 1, slot: 4, cost: { Gold:  1000 }, prereqs: [], description: 'Market ratio 5:1 → 4:1' },
  free_trade:            { id: 'free_trade',            name: 'Free Trade',            branch: 'economy', tier: 2, slot: 4, cost: { Gold:  4000 }, prereqs: ['banking'], description: 'Market ratio 4:1 → 3:1' },
  merchant_guild:        { id: 'merchant_guild',        name: 'Merchant Guild',        branch: 'economy', tier: 3, slot: 4, cost: { Gold: 10000 }, prereqs: ['free_trade'], description: 'Market ratio 3:1 → 2:1' },

  // ── Civic ────────────────────────────────────────────────────────────
  architecture: { id: 'architecture', name: 'Architecture', branch: 'civic', tier: 1, slot: 1, cost: { Gold:  500 }, prereqs: [], description: 'Each Housing level: +5 pop cap (→ 15/level)' },
  plumbing:     { id: 'plumbing',     name: 'Plumbing',     branch: 'civic', tier: 2, slot: 1, cost: { Gold: 1500 }, prereqs: ['architecture'], description: 'Population growth rate ×2' },
  sanitation:   { id: 'sanitation',   name: 'Sanitation',   branch: 'civic', tier: 3, slot: 1, cost: { Gold: 3000 }, prereqs: ['plumbing'], description: 'Housing: +10 pop/level more (→ 25/level)' },
  census:       { id: 'census',       name: 'Census',       branch: 'civic', tier: 4, slot: 1, cost: { Gold: 8000 }, prereqs: ['sanitation'], description: 'Worker cap per resource building 5 → 10' },
  bureaucracy:  { id: 'bureaucracy',  name: 'Bureaucracy',  branch: 'civic', tier: 1, slot: 2, cost: { Gold: 1000 }, prereqs: [], description: 'Max Action Points 100 → 150' },
  stewardship:  { id: 'stewardship',  name: 'Stewardship',  branch: 'civic', tier: 2, slot: 2, cost: { Gold: 3000 }, prereqs: ['bureaucracy'], description: 'AP regen 120s → 60s' },
  royal_decree: { id: 'royal_decree', name: 'Royal Decree', branch: 'civic', tier: 3, slot: 2, cost: { Gold: 8000 }, prereqs: ['stewardship'], description: 'Max AP 150 → 250, regen 30s' },

  // ── Construction ─────────────────────────────────────────────────────
  engineering:    { id: 'engineering',    name: 'Engineering',    branch: 'construction', tier: 1, slot: 1, cost: { Gold:  500 }, prereqs: [], description: 'Building Gold cost −25%' },
  foundations:    { id: 'foundations',    name: 'Foundations',    branch: 'construction', tier: 2, slot: 1, cost: { Gold: 1500 }, prereqs: ['engineering'], description: 'Building Wood cost −25%' },
  surveying:      { id: 'surveying',      name: 'Surveying',      branch: 'construction', tier: 2, slot: 2, cost: { Gold: 2000 }, prereqs: ['engineering'], description: 'Building land cost −1 (min 0)' },
  megastructures: { id: 'megastructures', name: 'Megastructures', branch: 'construction', tier: 3, slot: 2, cost: { Gold: 6000 }, prereqs: ['foundations', 'surveying'], description: 'Building land cost halved (rounded down)' },

  // ── Espionage ────────────────────────────────────────────────────────
  espionage_101: { id: 'espionage_101', name: 'Espionage 101', branch: 'espionage', tier: 1, slot: 1, cost: { Gold:  1000 }, prereqs: [], description: 'Each Spy generates +2 Gold per tick' },
  subterfuge:    { id: 'subterfuge',    name: 'Subterfuge',    branch: 'espionage', tier: 2, slot: 1, cost: { Gold:  3000 }, prereqs: ['espionage_101'], description: 'Each Spy also +1 random resource per tick' },
  sabotage:      { id: 'sabotage',      name: 'Sabotage',      branch: 'espionage', tier: 3, slot: 1, cost: { Gold:  6000 }, prereqs: ['subterfuge'], description: 'Kidnap costs 1 troop instead of 2' },
  master_spies:  { id: 'master_spies',  name: 'Master Spies',  branch: 'espionage', tier: 4, slot: 1, cost: { Gold: 10000 }, prereqs: ['sabotage'], description: 'Spies count as Tier 1 troops for attack/defense' },

  // ── Magic ────────────────────────────────────────────────────────────
  mana_awakening:   { id: 'mana_awakening',   name: 'Mana Awakening',   branch: 'magic', tier: 1, slot: 2, cost: { Gold: 2000 }, prereqs: [], description: 'Unlocks the Magic tree. +5 base Mana production' },
  spark:            { id: 'spark',            name: 'Spark',            branch: 'magic', tier: 2, slot: 1, cost: { Mana:  100 }, prereqs: ['mana_awakening'], description: 'Conquest now costs 5% troops (was 10%)' },
  mending:          { id: 'mending',          name: 'Mending',          branch: 'magic', tier: 2, slot: 2, cost: { Mana:  100 }, prereqs: ['mana_awakening'], description: 'Half of Conquest troop losses return as Tier 1' },
  scrying:          { id: 'scrying',          name: 'Scrying',          branch: 'magic', tier: 2, slot: 3, cost: { Mana:  100 }, prereqs: ['mana_awakening'], description: 'Spy hire/fire no longer costs AP' },
  fireball:         { id: 'fireball',         name: 'Fireball',         branch: 'magic', tier: 3, slot: 1, cost: { Mana:  300 }, prereqs: ['spark'], description: 'Each Conquest grants +5 acres bonus' },
  greater_heal:     { id: 'greater_heal',     name: 'Greater Heal',     branch: 'magic', tier: 3, slot: 2, cost: { Mana:  300 }, prereqs: ['mending'], description: 'Population growth rate +50%' },
  minds_eye:        { id: 'minds_eye',        name: "Mind's Eye",       branch: 'magic', tier: 3, slot: 3, cost: { Mana:  300 }, prereqs: ['scrying'], description: 'Each Spy +1 random resource per tick (stacks)' },
  conjure_familiar: { id: 'conjure_familiar', name: 'Conjure Familiar', branch: 'magic', tier: 3, slot: 4, cost: { Mana:  400 }, prereqs: ['spark', 'mending'], description: 'All troops +5% attack and +5% defense' },
  inferno:          { id: 'inferno',          name: 'Inferno',          branch: 'magic', tier: 4, slot: 1, cost: { Mana:  800 }, prereqs: ['fireball'], description: 'Conquest costs 0% troops (no losses)' },
  sanctuary:        { id: 'sanctuary',        name: 'Sanctuary',        branch: 'magic', tier: 4, slot: 2, cost: { Mana:  800 }, prereqs: ['greater_heal'], description: 'Locked resources still produce at half rate' },
  charm:            { id: 'charm',            name: 'Charm',            branch: 'magic', tier: 4, slot: 3, cost: { Mana:  800 }, prereqs: ['minds_eye'], description: 'Spies count as peasants for population attack/defense bonus' },
  elemental_pact:   { id: 'elemental_pact',   name: 'Elemental Pact',   branch: 'magic', tier: 4, slot: 4, cost: { Mana: 1000 }, prereqs: ['conjure_familiar', 'scrying'], description: 'All resource production +50% (multiplicative)' },
  archmage:         { id: 'archmage',         name: 'Archmage',         branch: 'magic', tier: 5, slot: 3, cost: { Mana: 2500 }, prereqs: ['inferno', 'sanctuary', 'charm', 'elemental_pact'], description: 'Capstone: +25% troop stats, +100 max AP' },
};

export const HEROES: Record<string, Hero> = {
  // ── Common — 1 000 g ────────────────────────────────────────────────
  town_crier:     { id: 'town_crier',     name: 'Town Crier',     icon: '🗣️', rarity: 'common', cost: { Gold: 1000 }, description: 'Population growth +50%' },
  innkeeper:      { id: 'innkeeper',      name: 'Innkeeper',      icon: '🍺', rarity: 'common', cost: { Gold: 1000 }, description: 'Tavern & Housing upgrade cost −25%' },
  village_elder:  { id: 'village_elder',  name: 'Village Elder',  icon: '👴', rarity: 'common', cost: { Gold: 1000 }, description: '+5 Gold per tick (flat)' },
  wandering_bard: { id: 'wandering_bard', name: 'Wandering Bard', icon: '🎻', rarity: 'common', cost: { Gold: 1000 }, description: 'AP regen 20% faster' },
  pickpocket:     { id: 'pickpocket',     name: 'Pickpocket',     icon: '🪙', rarity: 'common', cost: { Gold: 1000 }, description: 'Each Spy +1 Gold per tick' },

  // ── Uncommon — 3 000 g ──────────────────────────────────────────────
  master_farmer:      { id: 'master_farmer',      name: 'Master Farmer',      icon: '🌾', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Food production +50%' },
  master_lumberjack:  { id: 'master_lumberjack',  name: 'Master Lumberjack',  icon: '🪓', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Wood production +50%' },
  foreman_mines:      { id: 'foreman_mines',      name: 'Foreman of Mines',   icon: '⛏️', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Iron + Gold production +50%' },
  arcane_researcher:  { id: 'arcane_researcher',  name: 'Arcane Researcher',  icon: '🔮', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Mana production +25%, research Mana costs −15%' },
  trade_baron:        { id: 'trade_baron',        name: 'Trade Baron',        icon: '⚖️', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Market ratio −1' },
  royal_weaponsmith:  { id: 'royal_weaponsmith',  name: 'Royal Weaponsmith',  icon: '🗡️', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'All troops attack +1' },
  master_armorer:     { id: 'master_armorer',     name: 'Master Armorer',     icon: '🛡️', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'All troops defense +1' },
  veteran_scout:      { id: 'veteran_scout',      name: 'Veteran Scout',      icon: '🐎', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Explore gives 1.5× acres' },
  drill_sergeant:     { id: 'drill_sergeant',     name: 'Drill Sergeant',     icon: '📣', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Troop training Food/Iron −50%' },
  master_builder:     { id: 'master_builder',     name: 'Master Builder',     icon: '🏗️', rarity: 'uncommon', cost: { Gold: 3000 }, description: 'Building Gold/Wood costs −25%' },

  // ── Rare — 10 000 g ─────────────────────────────────────────────────
  war_general:         { id: 'war_general',         name: 'War General',         icon: '⚔️', rarity: 'rare', cost: { Gold: 10000 }, description: 'Conquest gains +50% acres' },
  cunning_tactician:   { id: 'cunning_tactician',   name: 'Cunning Tactician',   icon: '🎯', rarity: 'rare', cost: { Gold: 10000 }, description: 'Conquest troop losses halved' },
  court_architect:     { id: 'court_architect',     name: 'Court Architect',     icon: '🏛️', rarity: 'rare', cost: { Gold: 10000 }, description: 'Each Housing level +10 pop cap' },
  royal_steward:       { id: 'royal_steward',       name: 'Royal Steward',       icon: '👑', rarity: 'rare', cost: { Gold: 10000 }, description: 'Max AP +50, regen 2× faster' },
  spymaster:           { id: 'spymaster',           name: 'Spymaster',           icon: '🕵️', rarity: 'rare', cost: { Gold: 10000 }, description: 'Each Spy +3 Gold and +1 random resource/tick' },
  battlefield_surgeon: { id: 'battlefield_surgeon', name: 'Battlefield Surgeon', icon: '🚑', rarity: 'rare', cost: { Gold: 10000 }, description: '25% of Conquest losses revive as Tier 1' },
  loremaster:          { id: 'loremaster',          name: 'Loremaster',          icon: '📚', rarity: 'rare', cost: { Gold: 10000 }, description: 'All research Gold costs −20%' },

  // ── Epic — 25 000 g ─────────────────────────────────────────────────
  knight_commander: { id: 'knight_commander', name: 'Knight Commander', icon: '🛡️', rarity: 'epic', cost: { Gold: 25000 }, description: 'All troops +15% attack & defense' },
  archmagus:        { id: 'archmagus',        name: 'Archmagus',        icon: '🧙', rarity: 'epic', cost: { Gold: 25000 }, description: 'All research costs (gold & mana) −30%' },

  // ── Legendary — 50 000 g + 1 000 m ──────────────────────────────────
  dragon_rider: { id: 'dragon_rider', name: 'Dragon Rider', icon: '🐉', rarity: 'legendary', cost: { Gold: 50000, Mana: 1000 }, description: 'Conquest 0% losses, +25 bonus acres, all troops +10% atk/def', prereqs: { tavernLevel: 8, research: ['archmage'] } },
};

export const hasResearch = (id: string) => store.research.includes(id);
export const hasHero = (id: string) => store.heroes.includes(id);
export const heroSlotsTotal = () => store.buildings.Tavern;
export const heroSlotsUsed = () => store.heroes.length;
export const heroSlotsFree = () => heroSlotsTotal() - heroSlotsUsed();

export const canHireHero = (id: string) => {
  const h = HEROES[id];
  if (!h) return false;
  if (hasHero(id)) return false;
  if (heroSlotsFree() < 1) return false;
  if (h.prereqs?.tavernLevel && store.buildings.Tavern < h.prereqs.tavernLevel) return false;
  if (h.prereqs?.research && !h.prereqs.research.every(r => hasResearch(r))) return false;
  if (store.resources.Gold < h.cost.Gold) return false;
  if (h.cost.Mana !== undefined && store.resources.Mana < h.cost.Mana) return false;
  return true;
};

export const hireHero = (id: string) => {
  if (!canHireHero(id)) return;
  const h = HEROES[id];
  store.resources.Gold -= h.cost.Gold;
  if (h.cost.Mana !== undefined) store.resources.Mana -= h.cost.Mana;
  store.heroes.push(id);
  store.player.maxActionPoints = getMaxAP();
};

export const dismissHero = (id: string) => {
  const idx = store.heroes.indexOf(id);
  if (idx < 0) return;
  store.heroes.splice(idx, 1);
  store.player.maxActionPoints = getMaxAP();
};

// Derived helpers driven by research
export const getMaxAP = () => {
  let max = 100;
  if (hasResearch('bureaucracy')) max += 50;
  if (hasResearch('royal_decree')) max += 100;
  if (hasResearch('archmage')) max += 100;
  if (hasHero('royal_steward')) max += 50;
  return max;
};

export const getApRegenSeconds = () => {
  let base = 120;
  if (hasResearch('royal_decree')) base = 30;
  else if (hasResearch('stewardship')) base = 60;
  let mult = 1;
  if (hasHero('wandering_bard')) mult *= 0.8;
  if (hasHero('royal_steward')) mult *= 0.5;
  return Math.max(1, Math.floor(base * mult));
};

export const getTradeRatio = () => {
  let r = 5;
  if (hasResearch('merchant_guild')) r = 2;
  else if (hasResearch('free_trade')) r = 3;
  else if (hasResearch('banking')) r = 4;
  if (hasHero('trade_baron')) r = Math.max(1, r - 1);
  return r;
};

export const popPerHousing = () => {
  let n = 10;
  if (hasResearch('architecture')) n += 5;
  if (hasResearch('sanitation')) n += 10;
  if (hasHero('court_architect')) n += 10;
  return n;
};

export const workerCapPerBuilding = () => hasResearch('census') ? 10 : 5;

export const effectiveBuildingCost = (level: number, type?: Resource | 'Barracks' | 'Housing' | 'Tavern') => {
  const base = buildingCost(level);
  let gold = base.Gold;
  let wood = base.Wood;
  if (hasResearch('engineering')) gold *= 0.75;
  if (hasResearch('foundations')) wood *= 0.75;
  if (hasHero('master_builder')) { gold *= 0.75; wood *= 0.75; }
  if (hasHero('innkeeper') && (type === 'Tavern' || type === 'Housing')) {
    gold *= 0.75; wood *= 0.75;
  }
  return { Gold: Math.floor(gold), Wood: Math.floor(wood) };
};

export const effectiveBuildingLand = (type: Resource | 'Barracks' | 'Housing' | 'Tavern') => {
  let land = BUILDING_LAND[type];
  if (hasResearch('surveying')) land = Math.max(0, land - 1);
  if (hasResearch('megastructures')) land = Math.floor(land / 2);
  return land;
};

export const troopAttackBonus = (tier: 1 | 2 | 3) => {
  let b = 0;
  if (tier === 1) {
    if (hasResearch('iron_weapons')) b += 1;
    if (hasResearch('steel_weapons')) b += 2;
  } else if (tier === 2) {
    if (hasResearch('steel_weapons')) b += 1;
    if (hasResearch('forged_blades')) b += 2;
  } else {
    if (hasResearch('forged_blades')) b += 1;
    if (hasResearch('master_smithing')) b += 3;
  }
  if (hasHero('royal_weaponsmith')) b += 1;
  return b;
};

export const troopDefenseBonus = (tier: 1 | 2 | 3) => {
  let b = 0;
  if (tier === 1) {
    if (hasResearch('leather_armor')) b += 1;
    if (hasResearch('chain_mail')) b += 2;
  } else if (tier === 2) {
    if (hasResearch('chain_mail')) b += 1;
    if (hasResearch('plate_armor')) b += 2;
  } else {
    if (hasResearch('plate_armor')) b += 1;
    if (hasResearch('tempered_steel')) b += 3;
  }
  if (hasHero('master_armorer')) b += 1;
  return b;
};

export const troopMultiplier = () => {
  let m = 1;
  if (hasResearch('conjure_familiar')) m *= 1.05;
  if (hasResearch('archmage')) m *= 1.25;
  if (hasHero('knight_commander')) m *= 1.15;
  if (hasHero('dragon_rider')) m *= 1.10;
  return m;
};

export const trainingCost = (kind: 'tier1' | 'promote') => {
  const base = TRAINING_COSTS[kind];
  let food = base.Food;
  let iron = base.Iron;
  if (hasHero('drill_sergeant')) { food *= 0.5; iron *= 0.5; }
  return { Gold: base.Gold, Food: Math.floor(food), Iron: Math.floor(iron) };
};

export const effectiveResearchCost = (r: Research) => {
  let gold = r.cost.Gold ?? 0;
  let mana = r.cost.Mana ?? 0;
  if (hasHero('loremaster')) gold *= 0.8;
  if (hasHero('archmagus')) { gold *= 0.7; mana *= 0.7; }
  if (hasHero('arcane_researcher')) mana *= 0.85;
  return { Gold: Math.floor(gold), Mana: Math.floor(mana) };
};

export const isResearchAvailable = (id: string) => {
  const r = RESEARCH[id];
  if (!r) return false;
  if (hasResearch(id)) return false;
  return r.prereqs.every(p => hasResearch(p));
};

export const researchUnlock = (id: string) => {
  const r = RESEARCH[id];
  if (!r) return;
  if (!isResearchAvailable(id)) return;
  const cost = effectiveResearchCost(r);
  if (r.cost.Gold !== undefined && store.resources.Gold < cost.Gold) return;
  if (r.cost.Mana !== undefined && store.resources.Mana < cost.Mana) return;
  if (r.cost.Gold !== undefined) store.resources.Gold -= cost.Gold;
  if (r.cost.Mana !== undefined) store.resources.Mana -= cost.Mana;
  store.research.push(id);
  store.player.maxActionPoints = getMaxAP();
};

export const RACE_CONFIG = {
  Human: { fixed: ['Wood', 'Food'] as Resource[], pickCount: 2, availableExtra: ['Gold', 'Mana', 'Iron'] as Resource[] },
  Elven: { fixed: ['Food', 'Mana'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Iron'] as Resource[] },
  Dwarf: { fixed: ['Food', 'Iron'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Mana'] as Resource[] },
  Orc: { fixed: ['Food'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Mana', 'Iron'] as Resource[] },
};

// Actions
export const constructBuilding = (type: Resource | 'Barracks' | 'Housing' | 'Tavern') => {
  if (store.player.actionPoints < 1) return;
  if (type === 'Tavern' && store.buildings.Tavern >= TAVERN_MAX_LEVEL) return;
  if (landUsed() + effectiveBuildingLand(type) > store.province.acres) return;

  const cost = effectiveBuildingCost(store.buildings[type], type);
  if (store.resources.Gold >= cost.Gold && store.resources.Wood >= cost.Wood) {
    store.resources.Gold -= cost.Gold;
    store.resources.Wood -= cost.Wood;
    store.buildings[type]++;
    store.player.actionPoints--;
  }
};

export const trainTroop = () => {
  const totalTroops = store.military.tier1 + store.military.tier2 + store.military.tier3;
  if (totalTroops >= store.buildings.Barracks * 10) return;

  const cost = trainingCost('tier1');
  if (store.resources.Gold >= cost.Gold && store.resources.Food >= cost.Food && store.resources.Iron >= cost.Iron) {
    store.resources.Gold -= cost.Gold;
    store.resources.Food -= cost.Food;
    store.resources.Iron -= cost.Iron;
    store.military.tier1++;
  }
};

export const promoteTroop = (fromTier: 1 | 2) => {
  const cost = trainingCost('promote');
  const count = fromTier === 1 ? store.military.tier1 : store.military.tier2;

  if (count > 0 && store.resources.Gold >= cost.Gold && store.resources.Food >= cost.Food && store.resources.Iron >= cost.Iron) {
    store.resources.Gold -= cost.Gold;
    store.resources.Food -= cost.Food;
    store.resources.Iron -= cost.Iron;
    if (fromTier === 1) {
      store.military.tier1--;
      store.military.tier2++;
    } else {
      store.military.tier2--;
      store.military.tier3++;
    }
  }
};

const consumeTroops = (n: number) => {
  let remaining = n;
  for (const tier of ['tier1', 'tier2', 'tier3'] as const) {
    const taken = Math.min(remaining, store.military[tier]);
    store.military[tier] -= taken;
    remaining -= taken;
    if (remaining === 0) return;
  }
};

const totalTroops = () => store.military.tier1 + store.military.tier2 + store.military.tier3;

export const conquest = () => {
  if (store.player.actionPoints < 1) return;
  const troops = totalTroops();
  if (troops < 3) return;

  let lossPct = 0.1;
  if (hasResearch('inferno') || hasHero('dragon_rider')) lossPct = 0;
  else if (hasResearch('spark')) lossPct = 0.05;
  if (hasHero('cunning_tactician')) lossPct *= 0.5;
  const losses = Math.ceil(troops * lossPct);

  let gain = Math.floor(troops / 3);
  if (hasResearch('fireball')) gain += 5;
  if (hasHero('dragon_rider')) gain += 25;
  if (hasResearch('war_banners')) gain = Math.floor(gain * 1.5);
  if (hasHero('war_general')) gain = Math.floor(gain * 1.5);

  consumeTroops(losses);
  let revivePct = 0;
  if (hasResearch('mending')) revivePct += 0.5;
  if (hasHero('battlefield_surgeon')) revivePct += 0.25;
  if (revivePct > 0 && losses > 0) {
    store.military.tier1 += Math.floor(losses * revivePct);
  }
  store.province.acres += gain;
  store.player.actionPoints--;
};

export const explore = () => {
  if (store.player.actionPoints < 1) return;
  const troops = totalTroops();
  if (troops < 5) return;
  let acres = Math.floor(troops / 5);
  if (hasHero('veteran_scout')) acres = Math.floor(acres * 1.5);
  store.province.acres += acres;
  store.player.actionPoints--;
};

export const kidnap = () => {
  if (store.player.actionPoints < 1) return;
  const cost = hasResearch('sabotage') ? 1 : 2;
  if (totalTroops() < cost) return;
  consumeTroops(cost);
  const maxPop = store.buildings.Housing * popPerHousing();
  store.province.population = Math.min(maxPop, store.province.population + 75);
  store.player.actionPoints--;
};

export const tradeResources = (from: Resource, to: Resource, amount: number) => {
  if (from === to) return;
  const ratio = getTradeRatio();
  const spend = Math.floor(amount / ratio) * ratio;
  if (spend < ratio) return;
  if (store.resources[from] < spend) return;
  store.resources[from] -= spend;
  store.resources[to] += spend / ratio;
};

export const gatherResources = () => {
  if (store.player.actionPoints < 1) return;
  const troops = totalTroops();
  if (troops < 1) return;
  const weights: [Resource, number][] = [
    ['Iron', 3], ['Wood', 3], ['Food', 1], ['Gold', 1], ['Mana', 1],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  for (let i = 0; i < troops; i++) {
    let roll = Math.random() * total;
    for (const [res, w] of weights) {
      roll -= w;
      if (roll <= 0) { store.resources[res] += 1; break; }
    }
  }
  store.player.actionPoints--;
};

export const startGame = (extraResources: Resource[]) => {
  if (!store.player.race) return;
  const config = RACE_CONFIG[store.player.race];
  store.player.startingResources = [...config.fixed, ...extraResources];
  store.player.unlockedResources = [...store.player.startingResources];
  
  (Object.keys(store.resources) as Resource[]).forEach(res => {
    store.resources[res] = store.player.unlockedResources.includes(res) ? 1000 : 0;
    store.workers[res] = { basic: 0, panda: 0 };
    store.buildings[res] = store.player.unlockedResources.includes(res) ? 1 : 0;
  });

  store.buildings.Barracks = 1;
  store.buildings.Housing = 10;
  store.buildings.Tavern = 1;
  store.heroes = [];
  store.workers.Food.basic = 5;
  store.player.spies = 0;
  store.phase = 'GAMEPLAY';
  store.lastTick = Date.now();
};

export const getTotalWorkers = () => {
  const assigned = (Object.values(store.workers) as WorkerState[]).reduce((acc, w) => acc + w.basic + w.panda, 0);
  return assigned + store.player.spies;
};

export const collectResources = () => {
  const now = Date.now();
  const deltaTime = (now - store.lastTick) / 1000;

  if (deltaTime >= 1) {
    // 1. Production
    (Object.keys(store.resources) as Resource[]).forEach(res => {
      const w = store.workers[res];
      let base = w.basic;
      if (!store.player.unlockedResources.includes(res) && hasResearch('sanctuary')) {
        base = Math.max(base, 0.5);
      }

      let mult = 1;
      if (res === 'Food') {
        if (hasResearch('agriculture')) mult += 0.25;
        if (hasResearch('crop_rotation')) mult += 0.5;
        if (hasHero('master_farmer')) mult += 0.5;
      } else if (res === 'Wood') {
        if (hasResearch('forestry')) mult += 0.25;
        if (hasResearch('lumber_mill')) mult += 0.5;
        if (hasHero('master_lumberjack')) mult += 0.5;
      } else if (res === 'Iron' || res === 'Gold') {
        if (hasResearch('mining')) mult += 0.25;
        if (hasResearch('deep_shafts')) mult += 0.5;
        if (hasHero('foreman_mines')) mult += 0.5;
      } else if (res === 'Mana') {
        if (hasHero('arcane_researcher')) mult += 0.25;
      }
      if (hasResearch('industrial_revolution')) mult *= 1.25;
      if (hasResearch('elemental_pact')) mult *= 1.5;

      let produced = base * mult;
      if (res === 'Mana' && hasResearch('mana_awakening')) produced += 5;

      store.resources[res] += produced;
    });

    // Village Elder: flat +5 gold per tick
    if (hasHero('village_elder')) store.resources.Gold += 5;

    // 1b. Spy income
    if (store.player.spies > 0) {
      if (hasResearch('espionage_101')) store.resources.Gold += store.player.spies * 2;
      if (hasHero('pickpocket')) store.resources.Gold += store.player.spies;
      if (hasHero('spymaster')) store.resources.Gold += store.player.spies * 3;
      const rolls =
        (hasResearch('subterfuge') ? 1 : 0) +
        (hasResearch('minds_eye') ? 1 : 0) +
        (hasHero('spymaster') ? 1 : 0);
      if (rolls > 0) {
        const resKeys = Object.keys(store.resources) as Resource[];
        for (let s = 0; s < store.player.spies; s++) {
          for (let r = 0; r < rolls; r++) {
            const pick = resKeys[Math.floor(Math.random() * resKeys.length)];
            store.resources[pick] += 1;
          }
        }
      }
    }

    // 2. AP Regeneration
    store.apAccumulator += 1;
    if (store.apAccumulator >= getApRegenSeconds()) {
      const maxAP = getMaxAP();
      if (store.player.actionPoints < maxAP) store.player.actionPoints++;
      store.apAccumulator = 0;
    }
    store.player.maxActionPoints = getMaxAP();

    // 3. Population Growth
    const maxPop = store.buildings.Housing * popPerHousing();
    if (store.province.population < maxPop) {
      let rate = 0.01;
      if (hasResearch('plumbing')) rate *= 2;
      if (hasResearch('greater_heal')) rate *= 1.5;
      if (hasHero('town_crier')) rate *= 1.5;
      const growth = (maxPop - store.province.population) * rate;
      store.province.population = Math.min(maxPop, store.province.population + Math.max(0.02, growth));
    }

    // 4. Consumption & Maintenance
    const troopsTotal = store.military.tier1 + store.military.tier2 + store.military.tier3;
    let foodPerTroop = 0.2;
    if (hasResearch('drill')) foodPerTroop *= 0.75;
    const foodCons = (store.province.population * 0.1) + (troopsTotal * foodPerTroop);
    store.resources.Food = Math.max(0, store.resources.Food - foodCons);

    let goldMaint = (store.military.tier1 * 1) + (store.military.tier2 * 3) + (store.military.tier3 * 7);
    if (hasResearch('quartermaster')) goldMaint *= 0.75;
    store.resources.Gold = Math.max(0, store.resources.Gold - goldMaint);

    if (store.resources.Food === 0) store.province.population = Math.max(10, store.province.population * 0.995);

    store.lastTick = now;
  }
};

export const manualCollect = (res: Resource) => {
  const w = store.workers[res];
  if (w.panda > 0) store.resources[res] += (w.panda * 5);
};

export const addWorker = (res: Resource, type: WorkerType) => {
    if (store.player.actionPoints < 1) return;
    if (!store.player.unlockedResources.includes(res)) return;
    const currentWorkers = store.workers[res].basic + store.workers[res].panda;
    if (currentWorkers >= store.buildings[res] * workerCapPerBuilding()) return;
    if (getTotalWorkers() < Math.floor(store.province.population)) {
        store.workers[res][type]++;
        store.player.actionPoints -= 1;
    }
};

export const removeWorker = (res: Resource, type: WorkerType) => {
    if (store.player.actionPoints < 1) return;
    if (store.workers[res][type] > 0) {
        store.workers[res][type]--;
        store.player.actionPoints -= 1;
    }
};

export const adjustSpies = (amount: number) => {
    const apCost = hasResearch('scrying') ? 0 : 1;
    if (store.player.actionPoints < apCost) return;
    if (amount > 0 && getTotalWorkers() < Math.floor(store.province.population)) {
        store.player.spies += amount;
        store.player.actionPoints -= apCost;
    } else if (amount < 0 && store.player.spies > 0) {
        store.player.spies += amount;
        store.player.actionPoints -= apCost;
    }
};

export const setRace = (race: Race) => {
  store.player.race = race;
  store.phase = 'CREATION_RESOURCES';
};

setInterval(collectResources, 1000);
