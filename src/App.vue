<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { store, serverClock } from './store/gameStore';
import { authState, isAuthenticated, logout } from './services/auth';
import { applyLoadedState, loadGame, saveGame, syncServerTime } from './services/api';
import AdminPanel from './components/AdminPanel.vue';
import LoginScreen from './components/LoginScreen.vue';
import RaceSelector from './components/RaceSelector.vue';
import ResourceSelector from './components/ResourceSelector.vue';
import Dashboard from './components/Dashboard.vue';
import './style.css';

const SAVE_DEBOUNCE_MS = 500;

const authed = ref(isAuthenticated());
const loading = ref(false);
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
let saveTimer: number | null = null;
let hydrating = false;
let stopWatcher: (() => void) | null = null;

const displayName = computed(() => authState.user?.displayName ?? authState.user?.email ?? '');

// Day/Night follow the SERVER clock (see /api/time). The frontend trusts the
// server's `isNight` flag directly — no timezone math, no extrapolation. The
// badge re-renders the instant serverClock.isNight flips after a poll.
const night = computed(() => serverClock.isNight);

const badgeTitle = computed(() => {
  if (!serverClock.haveSync) return 'Syncing with server…';
  return `${night.value ? 'Night' : 'Day'} · server hour ${serverClock.serverHour}:00 (day = 07:00–19:00)`;
});

let timeSyncTimer: number | null = null;
const startTimeSync = async () => {
  // Initial sync + re-poll every 60 s so transitions land within a minute.
  try { await syncServerTime(); } catch { /* will retry on next interval */ }
  if (timeSyncTimer === null) {
    timeSyncTimer = window.setInterval(() => {
      syncServerTime().catch(() => {});
    }, 60 * 1000);
  }
};
startTimeSync();

const saveStatusLabel = computed(() => {
  switch (saveStatus.value) {
    case 'saving': return 'Saving…';
    case 'saved': return 'Saved';
    case 'error': return 'Save failed';
    default: return '';
  }
});

const persistNow = async () => {
  if (!isAuthenticated()) return;
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    saveStatus.value = 'saving';
    await saveGame();
    saveStatus.value = 'saved';
  } catch {
    saveStatus.value = 'error';
  }
};

const scheduleSave = () => {
  if (!isAuthenticated() || hydrating) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, SAVE_DEBOUNCE_MS);
};

const startWatcher = () => {
  stopAutosave();
  stopWatcher = watch(
    () => [
      store.actionVersion,
      store.phase,
      store.player.name,
      store.player.race,
      store.player.spies,
      store.player.startingResources.join(','),
      store.player.unlockedResources.join(','),
      store.province.acres,
      JSON.stringify(store.buildings),
      JSON.stringify(store.military),
      JSON.stringify(store.workers),
      store.research.join(','),
      store.heroes.join(','),
      store.blooddolls,
    ],
    scheduleSave
  );
};

const stopAutosave = () => {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (stopWatcher) {
    stopWatcher();
    stopWatcher = null;
  }
};

const beforeUnload = () => {
  if (isAuthenticated()) {
    // Best-effort sync save on tab close — fetch with keepalive survives unload.
    const token = authState.token;
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5118';
    fetch(`${apiBase}/api/game/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        player: { ...store.player },
        province: { ...store.province },
        military: { ...store.military },
        buildings: { ...store.buildings },
        resources: { ...store.resources },
        workers: store.workers,
        phase: store.phase,
        research: store.research,
        heroes: store.heroes,
        attacks: store.attacks,
        blooddolls: store.blooddolls,
        blood: store.blood,
      }),
      keepalive: true,
    }).catch(() => {});
  }
};

const bootstrap = async () => {
  loading.value = true;
  hydrating = true;
  try {
    const loaded = await loadGame();
    if (loaded) applyLoadedState(loaded);
  } catch {
    // ignore — fresh start
  } finally {
    loading.value = false;
    // Start the watcher AFTER hydration so the load doesn't immediately trigger a save.
    hydrating = false;
    startWatcher();
    window.addEventListener('beforeunload', beforeUnload);
  }
};

if (authed.value) {
  bootstrap();
}

const onAuthenticated = async () => {
  authed.value = true;
  await bootstrap();
};

const signOut = async () => {
  await persistNow().catch(() => {});
  stopAutosave();
  window.removeEventListener('beforeunload', beforeUnload);
  logout();
  authed.value = false;
  saveStatus.value = 'idle';
};

watch(
  () => saveStatus.value,
  (status) => {
    if (status === 'saved' || status === 'error') {
      window.setTimeout(() => {
        if (saveStatus.value === status) saveStatus.value = 'idle';
      }, 2500);
    }
  }
);

onBeforeUnmount(() => {
  stopAutosave();
  window.removeEventListener('beforeunload', beforeUnload);
  if (timeSyncTimer !== null) {
    window.clearInterval(timeSyncTimer);
    timeSyncTimer = null;
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
    <Transition name="fade" mode="out-in">
      <LoginScreen v-if="!authed" key="auth" @authenticated="onAuthenticated" />
      <div v-else-if="loading" key="loading" class="min-h-screen flex items-center justify-center text-slate-400">
        Loading your realm…
      </div>
      <div v-else key="app">
        <header class="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <span class="text-sm text-slate-400">
            Signed in as <span class="text-slate-100 font-medium">{{ displayName }}</span>
          </span>
          <div class="flex items-center gap-4">
            <span
              :class="[
                'text-xs font-medium px-2 py-1 rounded border',
                night
                  ? 'bg-indigo-900/40 border-indigo-700 text-indigo-200'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-300',
                !serverClock.haveSync && 'opacity-60',
              ]"
              :title="badgeTitle"
            >
              {{ night ? '🌙 Night' : '☀️ Day' }}
            </span>
            <span v-if="saveStatusLabel" class="text-xs text-slate-400">{{ saveStatusLabel }}</span>
            <button
              type="button"
              class="text-xs text-slate-400 hover:text-amber-300 underline"
              @click="persistNow"
            >
              Save now
            </button>
            <button
              type="button"
              class="text-xs text-slate-400 hover:text-amber-300 underline"
              @click="signOut"
            >
              Sign out
            </button>
            <AdminPanel />
          </div>
        </header>

        <Transition name="fade" mode="out-in">
          <div v-if="store.phase === 'CREATION_RACE'" key="race">
            <RaceSelector />
          </div>
          <div v-else-if="store.phase === 'CREATION_RESOURCES'" key="resources">
            <ResourceSelector />
          </div>
          <div v-else-if="store.phase === 'GAMEPLAY'" key="game">
            <Dashboard />
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

body {
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
