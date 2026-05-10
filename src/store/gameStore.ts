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
    anumisSwarm: number;
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
  buildings: Record<Resource | 'Barracks' | 'Housing', number>;
  resources: Record<Resource, number>;
  workers: Record<Resource, WorkerState>;
  phase: 'CREATION_RACE' | 'CREATION_RESOURCES' | 'GAMEPLAY';
  lastTick: number;
  apAccumulator: number;
}

const initialState: GameState = {
  player: {
    name: 'Player',
    race: null,
    startingResources: [],
    unlockedResources: [],
    actionPoints: 100,
    maxActionPoints: 100,
    anumisSwarm: 0,
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
    Food: 2,
    Gold: 2,
    Mana: 0,
    Wood: 2,
    Iron: 0,
    Barracks: 1,
    Housing: 1,
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

export const BUILDING_COSTS = {
  Resource: { Gold: 300, Wood: 150 },
  Barracks: { Gold: 500, Wood: 300 },
  Housing: { Gold: 400, Wood: 250 }
};

export const RACE_CONFIG = {
  Human: { fixed: ['Wood', 'Food'] as Resource[], pickCount: 2, availableExtra: ['Gold', 'Mana', 'Iron'] as Resource[] },
  Elven: { fixed: ['Food', 'Mana'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Iron'] as Resource[] },
  Dwarf: { fixed: ['Food', 'Iron'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Mana'] as Resource[] },
  Orc: { fixed: ['Food'] as Resource[], pickCount: 1, availableExtra: ['Wood', 'Gold', 'Mana', 'Iron'] as Resource[] },
};

// Actions
export const constructBuilding = (type: Resource | 'Barracks' | 'Housing') => {
  if (store.player.actionPoints < 1) return;
  
  let cost;
  if (type === 'Barracks') cost = BUILDING_COSTS.Barracks;
  else if (type === 'Housing') cost = BUILDING_COSTS.Housing;
  else cost = BUILDING_COSTS.Resource;
  
  if (store.resources.Gold >= cost.Gold && store.resources.Wood >= cost.Wood) {
    store.resources.Gold -= cost.Gold;
    store.resources.Wood -= cost.Wood;
    store.buildings[type]++;
    store.player.actionPoints--;
  }
};

export const trainTroop = () => {
  if (store.player.actionPoints < 1) return;
  const totalTroops = store.military.tier1 + store.military.tier2 + store.military.tier3;
  if (totalTroops >= store.buildings.Barracks * 10) return;

  const cost = TRAINING_COSTS.tier1;
  if (store.resources.Gold >= cost.Gold && store.resources.Food >= cost.Food && store.resources.Iron >= cost.Iron) {
    store.resources.Gold -= cost.Gold;
    store.resources.Food -= cost.Food;
    store.resources.Iron -= cost.Iron;
    store.military.tier1++;
    store.player.actionPoints--;
  }
};

export const promoteTroop = (fromTier: 1 | 2) => {
  if (store.player.actionPoints < 1) return;
  const cost = TRAINING_COSTS.promote;
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
    store.player.actionPoints--;
  }
};

export const startGame = (extraResources: Resource[]) => {
  if (!store.player.race) return;
  const config = RACE_CONFIG[store.player.race];
  store.player.startingResources = [...config.fixed, ...extraResources];
  store.player.unlockedResources = [...store.player.startingResources];
  
  (Object.keys(store.resources) as Resource[]).forEach(res => {
    store.resources[res] = store.player.unlockedResources.includes(res) ? 1000 : 0;
    store.workers[res] = { basic: 0, panda: 0 };
    store.buildings[res] = store.player.unlockedResources.includes(res) ? 2 : 0;
  });

  store.buildings.Barracks = 1;
  store.buildings.Housing = 1;
  store.workers.Food.basic = 5;
  store.player.anumisSwarm = 2;
  store.phase = 'GAMEPLAY';
  store.lastTick = Date.now();
};

export const getTotalWorkers = () => {
  const assigned = (Object.values(store.workers) as WorkerState[]).reduce((acc, w) => acc + w.basic + w.panda, 0);
  return assigned + store.player.anumisSwarm;
};

export const collectResources = () => {
  const now = Date.now();
  const deltaTime = (now - store.lastTick) / 1000;
  
  if (deltaTime >= 1) {
    const unlockedKeys = store.player.unlockedResources;
    const lowestRes = unlockedKeys.length > 0 
      ? unlockedKeys.reduce((prev, curr) => store.resources[curr] < store.resources[prev] ? curr : prev)
      : null;

    // 1. Production
    (Object.keys(store.resources) as Resource[]).forEach(res => {
      const w = store.workers[res];
      let amount = w.basic * 1;
      if (lowestRes && res === lowestRes) amount += store.player.anumisSwarm * 2;
      store.resources[res] += amount;
    });

    // 2. AP Regeneration (1 point every 120 seconds)
    store.apAccumulator += 1;
    if (store.apAccumulator >= 120) {
      if (store.player.actionPoints < store.player.maxActionPoints) store.player.actionPoints++;
      store.apAccumulator = 0;
    }

    // 3. Population Growth
    const maxPop = store.buildings.Housing * 100;
    if (store.province.population < maxPop) {
      const growth = (maxPop - store.province.population) * 0.01;
      store.province.population = Math.min(maxPop, store.province.population + Math.max(0.02, growth));
    }

    // 4. Consumption & Maintenance
    const totalTroops = store.military.tier1 + store.military.tier2 + store.military.tier3;
    const foodCons = (store.province.population * 0.1) + (totalTroops * 0.2);
    store.resources.Food = Math.max(0, store.resources.Food - foodCons);
    const goldMaint = (store.military.tier1 * 1) + (store.military.tier2 * 3) + (store.military.tier3 * 7);
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
    if (currentWorkers >= store.buildings[res] * 5) return;
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

export const adjustAnumisSwarm = (amount: number) => {
    if (store.player.actionPoints < 1) return;
    if (amount > 0 && getTotalWorkers() < Math.floor(store.province.population)) {
        store.player.anumisSwarm += amount;
        store.player.actionPoints -= 1;
    } else if (amount < 0 && store.player.anumisSwarm > 0) {
        store.player.anumisSwarm += amount;
        store.player.actionPoints -= 1;
    }
};

export const setRace = (race: Race) => {
  store.player.race = race;
  store.phase = 'CREATION_RESOURCES';
};

setInterval(collectResources, 1000);
