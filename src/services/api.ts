import { GameState, serverClock, store } from '../store/gameStore';
import { authState, logout } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5118';

type SaveablePlayer = Omit<GameState['player'], 'race'> & { race: GameState['player']['race'] };

interface SaveableState {
  player: SaveablePlayer;
  province: GameState['province'];
  military: GameState['military'];
  buildings: GameState['buildings'];
  resources: GameState['resources'];
  workers: GameState['workers'];
  phase: GameState['phase'];
  research: GameState['research'];
  heroes: GameState['heroes'];
  blooddolls: number;
  blood: number;
}

function snapshot(state: GameState): SaveableState {
  return {
    player: {
      name: state.player.name,
      race: state.player.race,
      startingResources: [...state.player.startingResources],
      unlockedResources: [...state.player.unlockedResources],
      actionPoints: state.player.actionPoints,
      maxActionPoints: state.player.maxActionPoints,
      spies: state.player.spies,
    },
    province: { ...state.province },
    military: { ...state.military },
    buildings: { ...state.buildings },
    resources: { ...state.resources },
    workers: Object.fromEntries(
      Object.entries(state.workers).map(([res, w]) => [res, { basic: w.basic, panda: w.panda }])
    ) as GameState['workers'],
    phase: state.phase,
    research: [...state.research],
    heroes: [...state.heroes],
    blooddolls: state.blooddolls,
    blood: state.blood,
  };
}

export const syncServerTime = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/time`);
  if (!response.ok) throw new Error(`Server time sync failed: ${response.status}`);
  const data = (await response.json()) as { isNight: boolean; serverHour: number };
  serverClock.isNight = data.isNight;
  serverClock.serverHour = data.serverHour;
  serverClock.syncedAt = Date.now();
  serverClock.haveSync = true;
};

function authHeaders(): HeadersInit {
  if (!authState.token) throw new Error('Not signed in.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authState.token}`,
  };
}

export const saveGame = async (state: GameState = store): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/game/state`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(snapshot(state)),
  });
  if (response.status === 401) {
    logout();
    throw new Error('Session expired.');
  }
  if (!response.ok) {
    throw new Error(`Save failed (${response.status}).`);
  }
};

export const loadGame = async (): Promise<Partial<GameState> | null> => {
  const response = await fetch(`${API_BASE_URL}/api/game/state`, {
    headers: { Authorization: `Bearer ${authState.token ?? ''}` },
  });
  if (response.status === 204) return null;
  if (response.status === 401) {
    logout();
    return null;
  }
  if (!response.ok) {
    throw new Error(`Load failed (${response.status}).`);
  }
  return (await response.json()) as Partial<GameState>;
};

export function applyLoadedState(loaded: Partial<GameState>) {
  if (loaded.player) Object.assign(store.player, loaded.player);
  if (loaded.province) Object.assign(store.province, loaded.province);
  if (loaded.military) Object.assign(store.military, loaded.military);
  if (loaded.buildings) Object.assign(store.buildings, loaded.buildings);
  if (loaded.resources) Object.assign(store.resources, loaded.resources);
  if (loaded.workers) {
    for (const [res, w] of Object.entries(loaded.workers)) {
      if (store.workers[res as keyof typeof store.workers]) {
        Object.assign(store.workers[res as keyof typeof store.workers], w);
      }
    }
  }
  if (loaded.phase) store.phase = loaded.phase;
  if (loaded.research) store.research = [...loaded.research];
  if (loaded.heroes) store.heroes = [...loaded.heroes];
  if (typeof loaded.blooddolls === 'number') store.blooddolls = loaded.blooddolls;
  if (typeof loaded.blood === 'number') store.blood = loaded.blood;
  store.lastTick = Date.now();
  store.apAccumulator = 0;
}
