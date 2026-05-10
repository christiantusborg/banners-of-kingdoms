<script setup lang="ts">
import { store, Resource, manualCollect, addWorker, removeWorker, WorkerType, getTotalWorkers, adjustAnumisSwarm, trainTroop, promoteTroop, TROOP_CONFIG, TRAINING_COSTS, constructBuilding, BUILDING_COSTS } from '../store/gameStore';
import { saveGame } from '../services/api';
import { computed } from 'vue';

const totalWorkers = computed(() => getTotalWorkers());

const militaryStats = computed(() => {
  const race = store.player.race || 'Human';
  const config = TROOP_CONFIG[race];
  
  // Base stats from Troops
  let att = (store.military.tier1 * config.tier1.attack) +
              (store.military.tier2 * config.tier2.attack) +
              (store.military.tier3 * config.tier3.attack);
              
  let def = (store.military.tier1 * config.tier1.defense) +
              (store.military.tier2 * config.tier2.defense) +
              (store.military.tier3 * config.tier3.defense);
  
  // Bonus from Population (1 per peasant)
  const popBonus = Math.floor(store.province.population);
  att += popBonus;
  def += popBonus;
              
  return { attack: att, defense: def, popBonus };
});
const unassignedPop = computed(() => Math.max(0, Math.floor(store.province.population) - totalWorkers.value));
const employmentRate = computed(() => {
  if (store.province.population === 0) return 0;
  return Math.min(100, (totalWorkers.value / store.province.population) * 100);
});

const lowestResource = computed(() => {
  const unlockedKeys = store.player.unlockedResources;
  if (unlockedKeys.length === 0) return null;
  return unlockedKeys.reduce((prev, curr) => 
    store.resources[curr] < store.resources[prev] ? curr : prev
  );
});

const handleSave = () => {
  saveGame(store);
};

const resourceIcons: Record<Resource, string> = {
  Food: '🍞',
  Gold: '💰',
  Mana: '🔮',
  Wood: '🪵',
  Iron: '⚒️',
};

const workerTypes: { type: WorkerType; name: string; icon: string; desc: string }[] = [
  { type: 'basic', name: 'Basic', icon: '👷', desc: 'Collects 1 per tick' },
  { type: 'panda', name: 'Panda', icon: '🐼', desc: 'Collects on click' },
];
</script>

<template>
  <div class="p-8">
    <header class="flex flex-col gap-6 mb-8">
      <div class="flex justify-between items-center bg-slate-800 p-6 rounded-2xl border border-slate-700">
        <div class="flex items-center gap-8">
          <div>
            <h1 class="text-3xl font-bold text-amber-500">Fate of Kingdoms</h1>
            <p class="text-slate-400">Province of {{ store.player.name }} | {{ store.player.race }}</p>
          </div>
          <button 
            @click="handleSave"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-bold transition-colors"
          >
            💾 Save State
          </button>
        </div>
        <div class="flex gap-6">
          <div v-for="(count, res) in store.resources" :key="res" class="flex flex-col items-center">
            <span class="text-2xl">{{ resourceIcons[res as Resource] }}</span>
            <span :class="['font-bold text-xl', res === 'Food' && count < 100 ? 'text-red-500' : '']">{{ Math.floor(count) }}</span>
            <span class="text-xs text-slate-500 uppercase">{{ res }}</span>
          </div>
        </div>
      </div>

      <!-- Province Stats Bar -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center relative overflow-hidden group">
          <p class="text-xs text-amber-500 uppercase font-bold">Action Points</p>
          <p class="text-xl font-mono text-white">{{ store.player.actionPoints }} <span class="text-[10px] text-slate-500">Regen: {{ 120 - store.apAccumulator }}s</span></p>
          <div class="absolute bottom-0 left-0 h-1 bg-amber-500" :style="{ width: `${(store.player.actionPoints / store.player.maxActionPoints) * 100}%` }"></div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-blue-500/50 flex justify-between items-center bg-blue-900/10">
          <div>
            <p class="text-xs text-blue-400 uppercase font-bold">Anumis Swarm</p>
            <div class="flex items-center gap-2">
              <button @click="adjustAnumisSwarm(-1)" class="w-5 h-5 bg-blue-900/50 rounded flex items-center justify-center text-xs">-</button>
              <p class="text-xl font-mono text-blue-400">{{ store.player.anumisSwarm }}</p>
              <button @click="adjustAnumisSwarm(1)" class="w-5 h-5 bg-blue-900/50 rounded flex items-center justify-center text-xs">+</button>
            </div>
            <p class="text-[8px] text-blue-300 mt-1">Targeting: {{ lowestResource }} (+{{ store.player.anumisSwarm * 2 }})</p>
          </div>
          <span class="text-2xl animate-pulse">🤖</span>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold">Land</p>
            <p class="text-xl font-mono text-emerald-400">{{ store.province.acres }} <span class="text-xs">Acres</span></p>
          </div>
          <span class="text-2xl">🗺️</span>
        </div>
        
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center relative group">
          <div class="flex justify-between items-center mb-1">
            <p class="text-xs text-slate-500 uppercase font-bold">Population</p>
            <button 
              @click="constructBuilding('Housing')" 
              :disabled="store.player.actionPoints < 1 || store.resources.Gold < BUILDING_COSTS.Housing.Gold || store.resources.Wood < BUILDING_COSTS.Housing.Wood"
              class="text-[8px] bg-sky-900/50 hover:bg-sky-800 text-sky-200 px-1.5 py-0.5 rounded border border-sky-700 disabled:opacity-30"
              :title="`Build Housing (+100 Max Pop) - Cost: ${BUILDING_COSTS.Housing.Gold}g, ${BUILDING_COSTS.Housing.Wood}w`"
            >
              + Build House
            </button>
          </div>
          <p class="text-xl font-mono text-sky-400">{{ Math.floor(store.province.population) }} <span class="text-xs text-slate-600">/ {{ store.buildings.Housing * 100 }}</span></p>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold">Employment</p>
            <p class="text-xl font-mono text-amber-400">{{ employmentRate.toFixed(1) }}%</p>
          </div>
          <span class="text-2xl">💼</span>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center text-rose-400">
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold">Unassigned</p>
            <p class="text-xl font-mono">{{ unassignedPop }}</p>
          </div>
          <span class="text-2xl">⌛</span>
        </div>
      </div>
    </header>

    <main class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Resource Production -->
      <section class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
          <span>🏭</span> Production Hub
          <span class="text-xs font-normal text-slate-500 ml-auto">Cost: 1 AP per change</span>
        </h2>
        <div class="space-y-6">
          <div 
            v-for="(workers, res) in store.workers" 
            :key="res" 
            :class="[
              'p-4 rounded-xl border transition-all relative overflow-hidden',
              store.player.unlockedResources.includes(res as Resource) 
                ? 'bg-slate-900/50 border-slate-700/50' 
                : 'bg-slate-950/80 border-slate-800 opacity-50 grayscale',
              lowestResource === res && store.player.anumisSwarm > 0 ? 'ring-2 ring-blue-500/30' : ''
            ]"
          >
            <!-- Anumis Indicator Overlay -->
            <div v-if="lowestResource === res && store.player.anumisSwarm > 0" class="absolute top-0 right-0 bg-blue-600 text-[8px] text-white px-2 py-0.5 rounded-bl-lg font-bold z-20 animate-pulse">
              ANUMIS TARGET: +{{ store.player.anumisSwarm * 2 }}
            </div>

            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{{ resourceIcons[res as Resource] }}</span>
                <div>
                  <span class="text-xl font-bold">{{ res }}</span>
                  <p class="text-[10px] text-slate-500 uppercase">Workers: {{ (store.workers[res as Resource].basic + store.workers[res as Resource].panda) }} / {{ store.buildings[res as Resource] * 5 }}</p>
                </div>
              </div>
              
              <div class="flex flex-col items-end gap-2">
                <button 
                  v-if="store.player.unlockedResources.includes(res as Resource)"
                  @click="constructBuilding(res as Resource)" 
                  :disabled="store.player.actionPoints < 1 || store.resources.Gold < BUILDING_COSTS.Resource.Gold || store.resources.Wood < BUILDING_COSTS.Resource.Wood"
                  class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:opacity-50 rounded text-[10px] font-bold transition-all border border-emerald-600/30"
                  :title="`Build ${res} Facility (+5 Slots) - Cost: ${BUILDING_COSTS.Resource.Gold}g, ${BUILDING_COSTS.Resource.Wood}w`"
                >
                  <span v-if="store.resources.Gold < BUILDING_COSTS.Resource.Gold || store.resources.Wood < BUILDING_COSTS.Resource.Wood">Need Resources</span>
                  <span v-else>+ Build Facility (1 AP)</span>
                </button>
                <button
                  v-if="workers.panda > 0"
                  @click="manualCollect(res as Resource)"
                  class="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all transform active:scale-95 flex items-center gap-2"
                >
                  🐼 Collect
                </button>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div v-for="wt in workerTypes" :key="wt.type" class="flex flex-col items-center bg-slate-800 p-3 rounded-lg relative group">
                <span class="text-xl mb-1">{{ wt.icon }}</span>
                <span class="text-sm font-bold">{{ wt.name }}</span>
                <div class="flex items-center gap-3 mt-2">
                  <button 
                    @click="removeWorker(res as Resource, wt.type)" 
                    :disabled="store.player.actionPoints < 1"
                    class="w-6 h-6 bg-red-900/50 hover:bg-red-800 disabled:opacity-30 rounded flex items-center justify-center transition-colors"
                  >-</button>
                  <span class="font-mono">{{ workers[wt.type] }}</span>
                  <button 
                    @click="addWorker(res as Resource, wt.type)" 
                    :disabled="store.player.actionPoints < 1 || !store.player.unlockedResources.includes(res as Resource) || (store.workers[res as Resource].basic + store.workers[res as Resource].panda) >= store.buildings[res as Resource] * 5"
                    class="w-6 h-6 bg-blue-900/50 hover:bg-blue-800 disabled:opacity-30 rounded flex items-center justify-center transition-colors"
                  >+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Stats & Info -->
      <section class="space-y-8">
        <!-- War Room -->
        <div class="bg-slate-800 p-6 rounded-2xl border-2 border-rose-900/50">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h2 class="text-2xl font-bold flex items-center gap-2">
                <span class="text-rose-500">⚔️</span> War Room
              </h2>
              <p class="text-[10px] text-slate-500 uppercase mt-1">Capacity: {{ store.military.tier1 + store.military.tier2 + store.military.tier3 }} / {{ store.buildings.Barracks * 10 }} Troops</p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <button 
                @click="constructBuilding('Barracks')" 
                :disabled="store.player.actionPoints < 1 || store.resources.Gold < BUILDING_COSTS.Barracks.Gold || store.resources.Wood < BUILDING_COSTS.Barracks.Wood"
                class="px-2 py-1 bg-rose-900/50 hover:bg-rose-800 disabled:bg-slate-700 disabled:opacity-50 rounded text-[10px] font-bold transition-all border border-rose-800"
                :title="`Build Barracks (+10 Slots) - Cost: ${BUILDING_COSTS.Barracks.Gold}g, ${BUILDING_COSTS.Barracks.Wood}w`"
              >
                <span v-if="store.resources.Gold < BUILDING_COSTS.Barracks.Gold || store.resources.Wood < BUILDING_COSTS.Barracks.Wood">Need Resources</span>
                <span v-else>+ Build Barracks (1 AP)</span>
              </button>
              <div class="flex gap-2">
                <div class="bg-slate-900 px-3 py-1 rounded border border-rose-500/30 text-center relative group">
                  <p class="text-[10px] uppercase text-slate-500">Atk</p>
                  <p class="text-lg font-mono text-rose-500">{{ militaryStats.attack }}</p>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] whitespace-nowrap z-50">
                    Peasant Militia: +{{ militaryStats.popBonus }}
                  </div>
                </div>
                <div class="bg-slate-900 px-3 py-1 rounded border border-blue-500/30 text-center relative group">
                  <p class="text-[10px] uppercase text-slate-500">Def</p>
                  <p class="text-lg font-mono text-blue-500">{{ militaryStats.defense }}</p>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] whitespace-nowrap z-50">
                    Peasant Militia: +{{ militaryStats.popBonus }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 mb-6">
            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Tier 1 Recruits</p>
                <p class="text-xs text-slate-500">Count: {{ store.military.tier1 }}</p>
              </div>
              <button 
                @click="trainTroop" 
                :disabled="store.player.actionPoints < 1"
                class="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Train (1 AP)
              </button>
            </div>
            
            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Tier 2 Veterans</p>
                <p class="text-xs text-slate-500">Count: {{ store.military.tier2 }}</p>
              </div>
              <button 
                @click="promoteTroop(1)" 
                :disabled="store.player.actionPoints < 1 || store.military.tier1 === 0"
                class="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Promote (1 AP)
              </button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Tier 3 Elite</p>
                <p class="text-xs text-slate-500">Count: {{ store.military.tier3 }}</p>
              </div>
              <button 
                @click="promoteTroop(2)" 
                :disabled="store.player.actionPoints < 1 || store.military.tier2 === 0"
                class="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Promote (1 AP)
              </button>
            </div>
          </div>

          <div class="bg-slate-900 p-3 rounded-lg text-[10px] text-slate-400">
            <p class="uppercase font-bold mb-1 text-slate-500">Costs:</p>
            <p>Training T1: {{ TRAINING_COSTS.tier1.Gold }}g, {{ TRAINING_COSTS.tier1.Food }}f, {{ TRAINING_COSTS.tier1.Iron }}i</p>
            <p>Promotion: {{ TRAINING_COSTS.promote.Gold }}g, {{ TRAINING_COSTS.promote.Food }}f, {{ TRAINING_COSTS.promote.Iron }}i</p>
            <p class="mt-1 text-rose-400 italic">*Troops consume 0.2 Food per tick (Double a peasant!)</p>
          </div>
        </div>

        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h2 class="text-2xl font-bold mb-4">Worker Roles</h2>
          <div class="space-y-4 text-slate-400">
            <div class="flex items-start gap-4">
              <span class="text-2xl">👷</span>
              <div>
                <h3 class="font-bold text-slate-200">Basic Worker</h3>
                <p class="text-sm">Assigned to specific resource. Collects 1 per tick.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <span class="text-2xl animate-pulse">🤖</span>
              <div>
                <h3 class="font-bold text-blue-400">Anumis Swarm</h3>
                <p class="text-sm">Global pool. Automatically targets the resource you have the LEAST of. Collects 2 per Anumis.</p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <span class="text-2xl">🐼</span>
              <div>
                <h3 class="font-bold text-slate-200">Panda</h3>
                <p class="text-sm">Manual labor. Click the "Collect" button to gather a burst of resources.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 relative overflow-hidden">
          <div class="relative z-10">
            <h2 class="text-2xl font-bold mb-4 text-amber-500">Kingdom Overview</h2>
            <p class="text-slate-300">Your empire is growing. Assign workers to resources to increase your passive income. Use Pandas for manual boosts!</p>
          </div>
          <div class="absolute -right-10 -bottom-10 text-9xl opacity-10 rotate-12">🏰</div>
        </div>
      </section>
    </main>
  </div>
</template>
