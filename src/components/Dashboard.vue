<script setup lang="ts">
import { store, Resource, manualCollect, addWorker, removeWorker, WorkerType, getTotalWorkers, adjustSpies, adjustBlooddolls, trainTroop, promoteTroop, TROOP_CONFIG, constructBuilding, explore, launchSiege, launchRaid, launchSlaver, attackSlots, attackDurationMs, landUsed, tradeResources, effectiveBuildingCost, effectiveBuildingLand, getTradeRatio, popPerHousing, workerCapPerBuilding, troopAttackBonus, troopDefenseBonus, troopMultiplier, hasResearch, getApRegenSeconds, RESEARCH, isResearchAvailable, researchUnlock, effectiveResearchCost, trainingCost, ResearchBranch, HEROES, HeroRarity, hasHero, hireHero, dismissHero, canHireHero, heroSlotsTotal, heroSlotsUsed, heroSlotsFree, TAVERN_NAMES, TAVERN_MAX_LEVEL, isNight, PEASANT_COMBAT, troopsCombatActive, pandaAvailable, vampireCanSpendPop, vampirePrisoners, barracksCapacity, bloodCostFor, hasEnoughBlood } from '../store/gameStore';
import type { AttackMission } from '../store/gameStore';
import { saveGame } from '../services/api';
import { computed, ref, watch } from 'vue';

const totalWorkers = computed(() => getTotalWorkers());

const nightNow = computed(() => {
  // Reactive on the tick (lastTick is bumped every second in collectResources).
  void store.lastTick;
  return isNight();
});

const militaryStats = computed(() => {
  const race = store.player.race || 'Human';
  const config = TROOP_CONFIG[race];
  const combatActive = troopsCombatActive();
  void store.lastTick; // re-evaluate every tick so day/night flips show up live

  const t1AtkEach = config.tier1.attack + troopAttackBonus(1);
  const t2AtkEach = config.tier2.attack + troopAttackBonus(2);
  const t3AtkEach = config.tier3.attack + troopAttackBonus(3);
  const t1DefEach = config.tier1.defense + troopDefenseBonus(1);
  const t2DefEach = config.tier2.defense + troopDefenseBonus(2);
  const t3DefEach = config.tier3.defense + troopDefenseBonus(3);

  let att = combatActive ? (store.military.tier1 * t1AtkEach + store.military.tier2 * t2AtkEach + store.military.tier3 * t3AtkEach) : 0;
  let def = combatActive ? (store.military.tier1 * t1DefEach + store.military.tier2 * t2DefEach + store.military.tier3 * t3DefEach) : 0;

  if (hasResearch('master_spies') && combatActive) {
    att += store.player.spies * t1AtkEach;
    def += store.player.spies * t1DefEach;
  }

  const mult = troopMultiplier();
  att *= mult;
  def *= mult;

  // Peasant militia — race-aware. Vampires: 0 atk / 2 def, always available.
  const pc = PEASANT_COMBAT[race];
  let peasantHeads = Math.floor(store.province.population);
  if (hasResearch('charm')) peasantHeads += store.player.spies;
  const popAttack = peasantHeads * pc.attack;
  const popDefense = peasantHeads * pc.defense;
  att += popAttack;
  def += popDefense;

  return {
    attack: Math.floor(att),
    defense: Math.floor(def),
    popAttack,
    popDefense,
    combatActive,
  };
});
const unassignedPop = computed(() => Math.max(0, Math.floor(store.province.population) - totalWorkers.value));
const troopCount = computed(() => store.military.tier1 + store.military.tier2 + store.military.tier3);
const conquestPreview = computed(() => ({
  losses: Math.ceil(troopCount.value * 0.1),
  gain: Math.floor(troopCount.value / 3),
}));
const explorePreview = computed(() => Math.floor(troopCount.value / 5));
const landSummary = computed(() => ({ used: landUsed(), total: store.province.acres }));

const attackHours = computed(() => attackDurationMs() / 3_600_000);
const slotsFreeForAttack = computed(() => store.attacks.length < attackSlots());
const attackLabel = (a: AttackMission) => {
  if (a.type === 'siege') return 'Siege';
  if (a.type === 'raid') return 'Raid';
  return isVampire.value ? 'Plunder' : 'Slaver';
};
// store.lastTick advances every game tick, so this countdown re-renders
// once a second without its own timer.
const attackEta = (a: AttackMission) => {
  const ms = Math.max(0, a.endsAt - store.lastTick);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const tradeFrom = ref<Resource>(store.player.race === 'Vampire' ? 'Wood' : 'Food');
const tradeTo = ref<Resource>(store.player.race === 'Vampire' ? 'Iron' : 'Iron');
const tradeAmount = ref<number>(getTradeRatio());
const tradeMax = computed(() => Math.max(getTradeRatio(), Math.floor(store.resources[tradeFrom.value] / getTradeRatio()) * getTradeRatio()));
const tradeReceive = computed(() => Math.floor(tradeAmount.value / getTradeRatio()));
watch(tradeFrom, () => { tradeAmount.value = Math.min(tradeAmount.value, tradeMax.value); });
const doTrade = () => {
  tradeResources(tradeFrom.value, tradeTo.value, tradeAmount.value);
  tradeAmount.value = Math.min(tradeAmount.value, tradeMax.value);
};
const employmentRate = computed(() => {
  if (store.province.population === 0) return 0;
  return Math.min(100, (totalWorkers.value / store.province.population) * 100);
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

// Vampires call their basic workers Ghouls (and they only labor at half speed, at night).
const availableWorkerTypes = computed(() => {
  const isVampire = store.player.race === 'Vampire';
  return workerTypes
    .filter((wt) => wt.type !== 'panda' || pandaAvailable())
    .map((wt) =>
      isVampire && wt.type === 'basic'
        ? { ...wt, name: 'Ghoul', icon: '🧟', desc: 'Half-speed worker · night only' }
        : wt
    );
});

const isVampire = computed(() => store.player.race === 'Vampire');
const canTrainTroop = computed(() => vampireCanSpendPop());
const prisoners = computed(() => vampirePrisoners());
const ghoulTotal = computed(() =>
  (Object.values(store.workers)).reduce((acc, w) => acc + w.basic, 0)
);
const troopCountForBlood = computed(() => store.military.tier1 + store.military.tier2 + store.military.tier3);
const attackBloodCost = computed(() => bloodCostFor(troopCountForBlood.value));
const kidnapBloodCost = computed(() => bloodCostFor(hasResearch('sabotage') ? 1 : 2));

// Vampires hide Food from the UI — except when they actually have some on hand
// (plundered via Kidnap, looted via Gather). Then it shows up in every panel.
const ALL_RESOURCES: Resource[] = ['Food', 'Gold', 'Mana', 'Wood', 'Iron'];
const visibleResources = computed<Resource[]>(() => {
  if (!isVampire.value) return ALL_RESOURCES;
  const showFood = store.resources.Food > 0;
  return showFood ? ALL_RESOURCES : ALL_RESOURCES.filter(r => r !== 'Food');
});

const activeTab = ref<'empire' | 'research' | 'tavern'>('empire');

const rarityMeta: Record<HeroRarity, { label: string; title: string; border: string; chip: string }> = {
  common:    { label: 'Common',    title: 'text-slate-300',  border: 'border-slate-600',     chip: 'bg-slate-600' },
  uncommon:  { label: 'Uncommon',  title: 'text-emerald-400', border: 'border-emerald-700',  chip: 'bg-emerald-700' },
  rare:      { label: 'Rare',      title: 'text-sky-400',     border: 'border-sky-700',      chip: 'bg-sky-700' },
  epic:      { label: 'Epic',      title: 'text-violet-400',  border: 'border-violet-700',   chip: 'bg-violet-700' },
  legendary: { label: 'Legendary', title: 'text-amber-400',   border: 'border-amber-600',    chip: 'bg-amber-600' },
};
const rarityOrder: HeroRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const heroesByRarity = computed(() => {
  const out: Record<HeroRarity, typeof HEROES[string][]> = {
    common: [], uncommon: [], rare: [], epic: [], legendary: [],
  };
  for (const h of Object.values(HEROES)) out[h.rarity].push(h);
  return out;
});

const heroCostLabel = (h: typeof HEROES[string]) => {
  const parts = [`${h.cost.Gold}g`];
  if (h.cost.Mana !== undefined) parts.push(`${h.cost.Mana}m`);
  return parts.join(' + ');
};

const heroBlockReason = (h: typeof HEROES[string]) => {
  if (hasHero(h.id)) return 'Hired';
  if (h.prereqs?.tavernLevel && store.buildings.Tavern < h.prereqs.tavernLevel) {
    return `Tavern lv ${h.prereqs.tavernLevel}`;
  }
  if (h.prereqs?.research) {
    const missing = h.prereqs.research.filter(r => !hasResearch(r));
    if (missing.length) return `Needs: ${missing.map(id => RESEARCH[id]?.name ?? id).join(', ')}`;
  }
  if (heroSlotsFree() < 1) return 'No slots';
  if (store.resources.Gold < h.cost.Gold) return 'Need gold';
  if (h.cost.Mana !== undefined && store.resources.Mana < h.cost.Mana) return 'Need mana';
  return '';
};

const heroAtSlot = (slot: number) => store.heroes[slot - 1];

type ResearchDef = typeof RESEARCH[string];

const branchMeta: Record<ResearchBranch, { label: string; title: string; border: string; icon: string }> = {
  military:     { label: 'Military',     title: 'text-rose-400',    border: 'border-rose-900/50',    icon: '⚔️' },
  economy:      { label: 'Economy',      title: 'text-amber-400',   border: 'border-amber-900/50',   icon: '💰' },
  civic:        { label: 'Civic',        title: 'text-sky-400',     border: 'border-sky-900/50',     icon: '🏛️' },
  construction: { label: 'Construction', title: 'text-stone-400',   border: 'border-stone-700/50',   icon: '🏗️' },
  espionage:    { label: 'Espionage',    title: 'text-violet-400',  border: 'border-violet-900/50',  icon: '🕵️' },
  magic:        { label: 'Magic',        title: 'text-fuchsia-400', border: 'border-fuchsia-900/50', icon: '🔮' },
  warfare:      { label: 'Warfare',      title: 'text-orange-400',  border: 'border-orange-900/50',  icon: '🏴' },
};
const branchOrder: ResearchBranch[] = ['military', 'warfare', 'economy', 'civic', 'construction', 'espionage', 'magic'];

const researchByBranch = computed(() => {
  const out: Record<ResearchBranch, ResearchDef[]> = {
    military: [], economy: [], civic: [], construction: [], espionage: [], magic: [], warfare: [],
  };
  for (const r of Object.values(RESEARCH)) out[r.branch].push(r);
  return out;
});

const CELL_W = 220;
const CELL_H = 140;
const PAD = 20;

const tierColumns = (branch: ResearchBranch) => Math.max(...researchByBranch.value[branch].map(r => r.tier));
const slotRows = (branch: ResearchBranch) => Math.max(...researchByBranch.value[branch].map(r => r.slot));

const nodePos = (r: ResearchDef) => ({
  x: (r.tier - 1) * CELL_W + CELL_W / 2 + PAD,
  y: (r.slot - 1) * CELL_H + CELL_H / 2 + PAD,
});

const branchLinks = (branch: ResearchBranch) => {
  const items = researchByBranch.value[branch];
  const map = new Map(items.map(r => [r.id, r]));
  const links: { key: string; x1: number; y1: number; x2: number; y2: number; done: boolean }[] = [];
  for (const r of items) {
    for (const pid of r.prereqs) {
      const p = map.get(pid);
      if (!p) continue;
      const a = nodePos(p);
      const b = nodePos(r);
      links.push({ key: `${pid}->${r.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, done: hasResearch(pid) });
    }
  }
  return links;
};

const cardStateClass = (r: ResearchDef) => {
  if (hasResearch(r.id)) return 'bg-emerald-900/40 border-emerald-500';
  if (isResearchAvailable(r.id)) return 'bg-slate-900/80 border-amber-500/60';
  return 'bg-slate-900/30 border-slate-700 opacity-60';
};

const canAfford = (r: ResearchDef) => {
  const c = effectiveResearchCost(r);
  if (r.cost.Gold !== undefined && store.resources.Gold < c.Gold) return false;
  if (r.cost.Mana !== undefined && store.resources.Mana < c.Mana) return false;
  return true;
};

const costLabel = (r: ResearchDef) => {
  const c = effectiveResearchCost(r);
  return r.cost.Gold !== undefined ? `${c.Gold}g` : `${c.Mana}m`;
};
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
          <div v-for="res in visibleResources" :key="res" class="flex flex-col items-center">
            <span class="text-2xl">{{ resourceIcons[res] }}</span>
            <span :class="['font-bold text-xl', res === 'Food' && store.resources[res] < 100 ? 'text-red-500' : '']">{{ Math.floor(store.resources[res]) }}</span>
            <span class="text-xs text-slate-500 uppercase">{{ res }}</span>
          </div>
          <div v-if="isVampire" class="flex flex-col items-center" title="Blood — fuel for vampire combat. 1 per troop sent to fight.">
            <span class="text-2xl">🩸</span>
            <span class="font-bold text-xl text-rose-400">{{ Math.floor(store.blood) }}</span>
            <span class="text-xs text-slate-500 uppercase">Blood</span>
          </div>
        </div>
      </div>

      <!-- Province Stats Bar -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center relative overflow-hidden group">
          <p class="text-xs text-amber-500 uppercase font-bold">Action Points</p>
          <p class="text-xl font-mono text-white">{{ store.player.actionPoints }} <span class="text-[10px] text-slate-500">Regen: {{ getApRegenSeconds() - store.apAccumulator }}s</span></p>
          <div class="absolute bottom-0 left-0 h-1 bg-amber-500" :style="{ width: `${(store.player.actionPoints / store.player.maxActionPoints) * 100}%` }"></div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-blue-500/50 flex justify-between items-center bg-blue-900/10">
          <div>
            <p class="text-xs text-blue-400 uppercase font-bold">Spies</p>
            <div class="flex items-center gap-2">
              <button @click="adjustSpies(-1)" class="w-5 h-5 bg-blue-900/50 rounded flex items-center justify-center text-xs">-</button>
              <p class="text-xl font-mono text-blue-400">{{ store.player.spies }}</p>
              <button @click="adjustSpies(1)" class="w-5 h-5 bg-blue-900/50 rounded flex items-center justify-center text-xs">+</button>
            </div>
          </div>
          <span class="text-2xl">🕵️</span>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold">Land</p>
            <p class="text-xl font-mono text-emerald-400">{{ store.province.acres }} <span class="text-xs">Acres</span></p>
            <p class="text-[10px] text-slate-500">Land used: {{ landSummary.used }} / {{ landSummary.total }}</p>
          </div>
          <span class="text-2xl">🗺️</span>
        </div>
        
        <!-- Mortal races: Population / Employment / Unassigned -->
        <template v-if="!isVampire">
          <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center relative group">
            <div class="flex justify-between items-center mb-1">
              <p class="text-xs text-slate-500 uppercase font-bold">Population</p>
              <button
                @click="constructBuilding('Housing')"
                :disabled="store.player.actionPoints < 1 || store.resources.Gold < effectiveBuildingCost(store.buildings.Housing).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings.Housing).Wood || landSummary.used + effectiveBuildingLand('Housing') > store.province.acres"
                class="text-[8px] bg-sky-900/50 hover:bg-sky-800 text-sky-200 px-1.5 py-0.5 rounded border border-sky-700 disabled:opacity-30"
                :title="`Build Housing (+10 Max Pop) - Cost: ${effectiveBuildingCost(store.buildings.Housing).Gold}g, ${effectiveBuildingCost(store.buildings.Housing).Wood}w, ${effectiveBuildingLand('Housing')} land`"
              >
                + Build House
              </button>
            </div>
            <p class="text-xl font-mono text-sky-400">{{ Math.floor(store.province.population) }} <span class="text-xs text-slate-600">/ {{ store.buildings.Housing * popPerHousing() }}</span></p>
            <p class="text-[10px] text-slate-500 mt-1">Next: Lv {{ store.buildings.Housing + 1 }} — {{ effectiveBuildingCost(store.buildings.Housing).Gold }}g, {{ effectiveBuildingCost(store.buildings.Housing).Wood }}w · Land: +{{ effectiveBuildingLand('Housing') }}</p>
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
        </template>

        <!-- Vampires: Prisoners / Ghouls / Blood Dolls (no "pop", no "unemployed") -->
        <template v-else>
          <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div class="flex justify-between items-center mb-1">
              <p class="text-xs text-slate-500 uppercase font-bold">⛓️ Prisoners</p>
              <button
                @click="constructBuilding('Housing')"
                :disabled="store.player.actionPoints < 1 || store.resources.Gold < effectiveBuildingCost(store.buildings.Housing).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings.Housing).Wood || landSummary.used + effectiveBuildingLand('Housing') > store.province.acres"
                class="text-[8px] bg-sky-900/50 hover:bg-sky-800 text-sky-200 px-1.5 py-0.5 rounded border border-sky-700 disabled:opacity-30"
                :title="`Build Crypt (+${popPerHousing()} capacity) - Cost: ${effectiveBuildingCost(store.buildings.Housing).Gold}g, ${effectiveBuildingCost(store.buildings.Housing).Wood}w`"
              >
                + Build Crypt
              </button>
            </div>
            <p class="text-xl font-mono text-sky-400">{{ prisoners }} <span class="text-xs text-slate-600">/ {{ store.buildings.Housing * popPerHousing() }}</span></p>
            <p class="text-[10px] text-indigo-300 mt-1">Convert to Ghouls (workers), Blood Dolls, Spies, or Vampires</p>
          </div>

          <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
            <div>
              <p class="text-xs text-slate-500 uppercase font-bold">🧟 Ghouls</p>
              <p class="text-xl font-mono text-emerald-400">{{ ghoulTotal }}</p>
              <p class="text-[10px] text-slate-500">Assign via Production Hub below</p>
            </div>
            <span class="text-2xl">🧟</span>
          </div>

          <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div class="flex justify-between items-center mb-1">
              <p class="text-xs text-slate-500 uppercase font-bold">🩸 Blood Dolls</p>
              <div class="flex items-center gap-1">
                <button
                  @click="adjustBlooddolls(-1)"
                  :disabled="store.player.actionPoints < 1 || store.blooddolls < 1"
                  class="w-5 h-5 bg-red-900/50 hover:bg-red-800 disabled:opacity-30 rounded text-[10px]"
                  title="Kill 1 Blood Doll (pop is lost, costs 1 AP)"
                >-</button>
                <button
                  @click="adjustBlooddolls(1)"
                  :disabled="store.player.actionPoints < 1 || prisoners < 1"
                  class="w-5 h-5 bg-rose-900/50 hover:bg-rose-800 disabled:opacity-30 rounded text-[10px]"
                  title="Convert 1 Prisoner to Blood Doll (costs 1 AP)"
                >+</button>
              </div>
            </div>
            <p class="text-xl font-mono text-rose-400">{{ store.blooddolls }}</p>
            <p class="text-[10px] text-slate-500">Generates 0.5 🩸 each per tick at night</p>
          </div>
        </template>
      </div>
    </header>

    <nav class="mb-6 flex gap-2 border-b border-slate-700">
      <button
        @click="activeTab = 'empire'"
        :class="['px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2', activeTab === 'empire' ? 'text-amber-400 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300']"
      >🏰 Empire</button>
      <button
        @click="activeTab = 'research'"
        :class="['px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2', activeTab === 'research' ? 'text-amber-400 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300']"
      >📜 Research <span v-if="store.research.length" class="text-[10px] text-slate-400">({{ store.research.length }})</span></button>
      <button
        @click="activeTab = 'tavern'"
        :class="['px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2', activeTab === 'tavern' ? 'text-amber-400 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-300']"
      >🍺 Tavern <span class="text-[10px] text-slate-400">({{ heroSlotsUsed() }}/{{ heroSlotsTotal() }})</span></button>
    </nav>

    <main v-if="activeTab === 'empire'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Resource Production -->
      <section class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
        <h2 class="text-2xl font-bold mb-6 flex items-center gap-2">
          <span>🏭</span> Production Hub
          <span class="text-xs font-normal text-slate-500 ml-auto">Cost: 1 AP per change</span>
        </h2>
        <div class="space-y-6">
          <div
            v-for="res in visibleResources"
            :key="res"
            :class="[
              'p-4 rounded-xl border transition-all relative overflow-hidden',
              store.player.unlockedResources.includes(res)
                ? 'bg-slate-900/50 border-slate-700/50'
                : 'bg-slate-950/80 border-slate-800 opacity-50 grayscale',
            ]"
          >
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center gap-3">
                <span class="text-3xl">{{ resourceIcons[res as Resource] }}</span>
                <div>
                  <span class="text-xl font-bold">{{ res }}</span>
                  <p class="text-[10px] text-slate-500 uppercase">Workers: {{ (store.workers[res as Resource].basic + store.workers[res as Resource].panda) }} / {{ store.buildings[res as Resource] * workerCapPerBuilding() }}</p>
                </div>
              </div>
              
              <div class="flex flex-col items-end gap-2">
                <button
                  v-if="store.player.unlockedResources.includes(res as Resource)"
                  @click="constructBuilding(res as Resource)"
                  :disabled="store.player.actionPoints < 1 || store.resources.Gold < effectiveBuildingCost(store.buildings[res as Resource]).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings[res as Resource]).Wood || landSummary.used + effectiveBuildingLand(res as Resource) > store.province.acres"
                  class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:opacity-50 rounded text-[10px] font-bold transition-all border border-emerald-600/30"
                  :title="`Build ${res} Facility (+5 Slots) - Cost: ${effectiveBuildingCost(store.buildings[res as Resource]).Gold}g, ${effectiveBuildingCost(store.buildings[res as Resource]).Wood}w, ${effectiveBuildingLand(res as Resource)} land`"
                >
                  <span v-if="store.resources.Gold < effectiveBuildingCost(store.buildings[res as Resource]).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings[res as Resource]).Wood">Need Resources</span>
                  <span v-else-if="landSummary.used + effectiveBuildingLand(res as Resource) > store.province.acres">Need Land</span>
                  <span v-else>+ Build Facility (1 AP)</span>
                </button>
                <p v-if="store.player.unlockedResources.includes(res as Resource)" class="text-[10px] text-slate-500">
                  Next: Lv {{ store.buildings[res as Resource] + 1 }} — {{ effectiveBuildingCost(store.buildings[res as Resource]).Gold }}g, {{ effectiveBuildingCost(store.buildings[res as Resource]).Wood }}w · Land: +{{ effectiveBuildingLand(res as Resource) }}
                </p>
                <button
                  v-if="store.workers[res].panda > 0"
                  @click="manualCollect(res as Resource)"
                  class="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all transform active:scale-95 flex items-center gap-2"
                >
                  🐼 Collect
                </button>
              </div>
            </div>
            
            <div :class="['grid gap-4', availableWorkerTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2']">
              <div v-for="wt in availableWorkerTypes" :key="wt.type" class="flex flex-col items-center bg-slate-800 p-3 rounded-lg relative group">
                <span class="text-xl mb-1">{{ wt.icon }}</span>
                <span class="text-sm font-bold">{{ wt.name }}</span>
                <div class="flex items-center gap-3 mt-2">
                  <button 
                    @click="removeWorker(res as Resource, wt.type)" 
                    :disabled="store.player.actionPoints < 1"
                    class="w-6 h-6 bg-red-900/50 hover:bg-red-800 disabled:opacity-30 rounded flex items-center justify-center transition-colors"
                  >-</button>
                  <span class="font-mono">{{ store.workers[res][wt.type] }}</span>
                  <button
                    @click="addWorker(res as Resource, wt.type)"
                    :disabled="store.player.actionPoints < 1 || !store.player.unlockedResources.includes(res as Resource) || (store.workers[res as Resource].basic + store.workers[res as Resource].panda) >= store.buildings[res as Resource] * workerCapPerBuilding() || (isVampire && wt.type === 'basic' && !canTrainTroop)"
                    :title="isVampire && wt.type === 'basic' && !canTrainTroop ? 'No pop remaining — kidnap more first' : ''"
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
              <p class="text-[10px] text-slate-500 uppercase mt-1">Capacity: {{ store.military.tier1 + store.military.tier2 + store.military.tier3 }} / {{ barracksCapacity() }} Troops<span v-if="isVampire" class="text-indigo-300"> (3× per Barracks)</span></p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <button
                @click="constructBuilding('Barracks')"
                :disabled="store.player.actionPoints < 1 || store.resources.Gold < effectiveBuildingCost(store.buildings.Barracks).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings.Barracks).Wood || landSummary.used + effectiveBuildingLand('Barracks') > store.province.acres"
                class="px-2 py-1 bg-rose-900/50 hover:bg-rose-800 disabled:bg-slate-700 disabled:opacity-50 rounded text-[10px] font-bold transition-all border border-rose-800"
                :title="`Build Barracks (+10 Slots) - Cost: ${effectiveBuildingCost(store.buildings.Barracks).Gold}g, ${effectiveBuildingCost(store.buildings.Barracks).Wood}w, ${effectiveBuildingLand('Barracks')} land`"
              >
                <span v-if="store.resources.Gold < effectiveBuildingCost(store.buildings.Barracks).Gold || store.resources.Wood < effectiveBuildingCost(store.buildings.Barracks).Wood">Need Resources</span>
                <span v-else-if="landSummary.used + effectiveBuildingLand('Barracks') > store.province.acres">Need Land</span>
                <span v-else>+ Build Barracks (1 AP)</span>
              </button>
              <p class="text-[10px] text-slate-500">
                Next: Lv {{ store.buildings.Barracks + 1 }} — {{ effectiveBuildingCost(store.buildings.Barracks).Gold }}g, {{ effectiveBuildingCost(store.buildings.Barracks).Wood }}w · Land: +{{ effectiveBuildingLand('Barracks') }}
              </p>
              <div class="flex gap-2">
                <div class="bg-slate-900 px-3 py-1 rounded border border-rose-500/30 text-center relative group">
                  <p class="text-[10px] uppercase text-slate-500">Atk</p>
                  <p class="text-lg font-mono text-rose-500">{{ militaryStats.attack }}</p>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] whitespace-nowrap z-50">
                    Peasant Militia: +{{ militaryStats.popAttack }}
                    <span v-if="!militaryStats.combatActive" class="block text-amber-400">Troops idle (daytime)</span>
                  </div>
                </div>
                <div class="bg-slate-900 px-3 py-1 rounded border border-blue-500/30 text-center relative group">
                  <p class="text-[10px] uppercase text-slate-500">Def</p>
                  <p class="text-lg font-mono text-blue-500">{{ militaryStats.defense }}</p>
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-slate-700 p-2 rounded text-[10px] whitespace-nowrap z-50">
                    Peasant Militia: +{{ militaryStats.popDefense }}
                    <span v-if="!militaryStats.combatActive" class="block text-amber-400">Troops idle (daytime)</span>
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
                <p v-if="isVampire" class="text-[10px] text-indigo-300">Costs 1 pop · {{ Math.floor(store.province.population) }} remaining</p>
              </div>
              <button
                @click="trainTroop"
                :disabled="isVampire && !canTrainTroop"
                :title="isVampire && !canTrainTroop ? 'No pop remaining — kidnap more first' : ''"
                class="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Train
              </button>
            </div>
            
            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Tier 2 Veterans</p>
                <p class="text-xs text-slate-500">Count: {{ store.military.tier2 }}</p>
              </div>
              <button
                @click="promoteTroop(1)"
                :disabled="store.military.tier1 === 0"
                class="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Promote
              </button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Tier 3 Elite</p>
                <p class="text-xs text-slate-500">Count: {{ store.military.tier3 }}</p>
              </div>
              <button
                @click="promoteTroop(2)"
                :disabled="store.military.tier2 === 0"
                class="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Promote
              </button>
            </div>
          </div>

          <div class="bg-slate-900 p-3 rounded-lg text-[10px] text-slate-400">
            <p class="uppercase font-bold mb-1 text-slate-500">Costs:</p>
            <p>Training T1: {{ trainingCost('tier1').Gold }}g<template v-if="!isVampire">, {{ trainingCost('tier1').Food }}f</template>, {{ trainingCost('tier1').Iron }}i<template v-if="isVampire">, 1 pop</template></p>
            <p>Promotion: {{ trainingCost('promote').Gold }}g<template v-if="!isVampire">, {{ trainingCost('promote').Food }}f</template>, {{ trainingCost('promote').Iron }}i</p>
            <p v-if="!isVampire" class="mt-1 text-rose-400 italic">*Troops consume 0.2 Food per tick (Double a peasant!)</p>
            <p v-else class="mt-1 text-indigo-300 italic">*Vampires don't eat. Each new T1 conscript costs 1 pop, refilled only via Kidnap.</p>
          </div>
        </div>

        <!-- Troop Actions -->
        <div class="bg-slate-800 p-6 rounded-2xl border-2 border-rose-900/50">
          <h2 class="text-2xl font-bold flex items-center gap-2 mb-4">
            <span class="text-rose-500">🪖</span> Troop Actions
          </h2>
          <div class="flex flex-col gap-3">
            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
              <p class="font-bold text-slate-200 mb-1">Attacks Underway ({{ store.attacks.length }}/{{ attackSlots() }})</p>
              <p v-if="store.attacks.length === 0" class="text-xs text-slate-500">No attacks running. Attacks resolve after {{ attackHours }} hours (real time) — gains arrive when the troops return.</p>
              <div v-for="a in store.attacks" :key="a.id" class="flex justify-between items-center text-xs py-0.5">
                <span class="text-slate-300">{{ attackLabel(a) }} · {{ a.tier1 + a.tier2 + a.tier3 }} troops</span>
                <span class="text-amber-300 font-mono">⏳ {{ attackEta(a) }}</span>
              </div>
            </div>
            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Siege <span class="text-[10px] text-slate-500 font-normal">(was Conquest)</span></p>
                <p class="text-xs text-slate-500">Send all troops · +1 acre per 3 · lose 10% · takes {{ attackHours }}h</p>
                <p class="text-[10px] text-rose-300 mt-1">On return: +{{ conquestPreview.gain }} acres · -{{ conquestPreview.losses }} troops</p>
                <p v-if="isVampire" class="text-[10px] text-rose-400 mt-1">🩸 Costs {{ attackBloodCost }} blood ({{ Math.floor(store.blood) }} available)</p>
              </div>
              <button
                @click="launchSiege"
                :disabled="store.player.actionPoints < 1 || troopCount < 3 || !hasEnoughBlood(troopCount) || !slotsFreeForAttack"
                :title="!slotsFreeForAttack ? 'All attack slots are in use' : isVampire && !hasEnoughBlood(troopCount) ? `Need ${attackBloodCost} blood, have ${Math.floor(store.blood)}` : ''"
                class="px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Siege (1 AP)
              </button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Explore</p>
                <p class="text-xs text-slate-500">Scout with all troops · +1 acre per 5 · no losses</p>
                <p class="text-[10px] text-emerald-300 mt-1">Now: +{{ explorePreview }} acres</p>
              </div>
              <button
                @click="explore"
                :disabled="store.player.actionPoints < 1 || troopCount < 5"
                class="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Explore (1 AP)
              </button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">{{ isVampire ? 'Plunder Village' : 'Slaver' }} <span class="text-[10px] text-slate-500 font-normal">(was Kidnap)</span></p>
                <p v-if="isVampire" class="text-xs text-slate-500">+{{ hasResearch('manhunters') ? 100 : 75 }} prisoners · +{{ hasResearch('manhunters') ? 100 : 75 }} food · -{{ hasResearch('sabotage') ? 1 : 2 }} troops · takes {{ attackHours }}h</p>
                <p v-else class="text-xs text-slate-500">+{{ hasResearch('manhunters') ? 100 : 75 }} population · -{{ hasResearch('sabotage') ? 1 : 2 }} troops · takes {{ attackHours }}h</p>
                <p v-if="isVampire" class="text-[10px] text-rose-400 mt-1">🩸 Costs {{ kidnapBloodCost }} blood ({{ Math.floor(store.blood) }} available)</p>
              </div>
              <button
                @click="launchSlaver"
                :disabled="store.player.actionPoints < 1 || (store.military.tier1 + store.military.tier2 + store.military.tier3) < (hasResearch('sabotage') ? 1 : 2) || !hasEnoughBlood(hasResearch('sabotage') ? 1 : 2) || !slotsFreeForAttack"
                :title="!slotsFreeForAttack ? 'All attack slots are in use' : isVampire && !hasEnoughBlood(hasResearch('sabotage') ? 1 : 2) ? `Need ${kidnapBloodCost} blood, have ${Math.floor(store.blood)}` : ''"
                class="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                {{ isVampire ? 'Plunder' : 'Slaver' }} (1 AP)
              </button>
            </div>

            <div class="bg-slate-900/50 p-4 rounded-xl flex justify-between items-center border border-slate-700">
              <div>
                <p class="font-bold text-slate-200">Raid <span class="text-[10px] text-slate-500 font-normal">(was Gather)</span></p>
                <p class="text-xs text-slate-500">+1 random resource per troop · Iron &amp; Wood most likely · takes {{ attackHours }}h</p>
                <p v-if="isVampire" class="text-[10px] text-rose-400 mt-1">🩸 Costs {{ attackBloodCost }} blood ({{ Math.floor(store.blood) }} available)</p>
              </div>
              <button
                @click="launchRaid"
                :disabled="store.player.actionPoints < 1 || (store.military.tier1 + store.military.tier2 + store.military.tier3) < 1 || !hasEnoughBlood(troopCount) || !slotsFreeForAttack"
                :title="!slotsFreeForAttack ? 'All attack slots are in use' : isVampire && !hasEnoughBlood(troopCount) ? `Need ${attackBloodCost} blood, have ${Math.floor(store.blood)}` : ''"
                class="px-4 py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
              >
                Raid (1 AP)
              </button>
            </div>
          </div>
        </div>

        <!-- Market -->
        <div class="bg-slate-800 p-6 rounded-2xl border-2 border-amber-900/50">
          <h2 class="text-2xl font-bold flex items-center gap-2 mb-1">
            <span class="text-amber-500">⚖️</span> Market
          </h2>
          <p class="text-[10px] text-slate-500 uppercase mb-4">Trade ratio: {{ getTradeRatio() }} : 1</p>

          <div class="space-y-3">
            <div>
              <p class="text-[10px] uppercase font-bold text-slate-500 mb-1">From</p>
              <div :class="['grid gap-1', visibleResources.length === 5 ? 'grid-cols-5' : 'grid-cols-4']">
                <button
                  v-for="res in visibleResources"
                  :key="`from-${res}`"
                  @click="tradeFrom = res"
                  :disabled="res === tradeTo"
                  :class="[
                    'p-2 rounded border text-center transition-all',
                    tradeFrom === res ? 'bg-amber-700/40 border-amber-500' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500',
                    res === tradeTo ? 'opacity-30 cursor-not-allowed' : ''
                  ]"
                >
                  <span class="text-lg">{{ resourceIcons[res] }}</span>
                  <p class="text-[9px] text-slate-400">{{ res }}</p>
                  <p class="text-[9px] font-mono text-slate-500">{{ Math.floor(store.resources[res]) }}</p>
                </button>
              </div>
            </div>

            <div>
              <p class="text-[10px] uppercase font-bold text-slate-500 mb-1">To</p>
              <div :class="['grid gap-1', visibleResources.length === 5 ? 'grid-cols-5' : 'grid-cols-4']">
                <button
                  v-for="res in visibleResources"
                  :key="`to-${res}`"
                  @click="tradeTo = res"
                  :disabled="res === tradeFrom"
                  :class="[
                    'p-2 rounded border text-center transition-all',
                    tradeTo === res ? 'bg-amber-700/40 border-amber-500' : 'bg-slate-900/50 border-slate-700 hover:border-slate-500',
                    res === tradeFrom ? 'opacity-30 cursor-not-allowed' : ''
                  ]"
                >
                  <span class="text-lg">{{ resourceIcons[res] }}</span>
                  <p class="text-[9px] text-slate-400">{{ res }}</p>
                  <p class="text-[9px] font-mono text-slate-500">{{ Math.floor(store.resources[res]) }}</p>
                </button>
              </div>
            </div>

            <div class="pt-1">
              <div class="flex justify-between items-center mb-1">
                <p class="text-[10px] uppercase font-bold text-slate-500">Amount to spend</p>
                <p class="text-xs font-mono text-amber-400">{{ tradeAmount }}</p>
              </div>
              <input
                type="range"
                :min="getTradeRatio()"
                :max="tradeMax"
                :step="getTradeRatio()"
                v-model.number="tradeAmount"
                class="w-full accent-amber-500"
              />
              <div class="flex justify-between text-[9px] text-slate-500 mt-1">
                <span>{{ getTradeRatio() }}</span>
                <span>{{ tradeMax }}</span>
              </div>
            </div>

            <div class="bg-slate-900/50 p-3 rounded-lg text-center text-sm border border-slate-700">
              Spend <span class="font-bold text-rose-400">{{ tradeAmount }} {{ tradeFrom }}</span>
              <span class="text-slate-500"> → </span>
              Get <span class="font-bold text-emerald-400">{{ tradeReceive }} {{ tradeTo }}</span>
            </div>

            <button
              @click="doTrade"
              :disabled="tradeFrom === tradeTo || tradeAmount < getTradeRatio() || store.resources[tradeFrom] < tradeAmount"
              class="w-full px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
            >
              Trade
            </button>
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
              <span class="text-2xl">🕵️</span>
              <div>
                <h3 class="font-bold text-blue-400">Spies</h3>
                <p class="text-sm">Occupy worker slots but have no active role yet.</p>
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

    <section v-else-if="activeTab === 'research'" class="space-y-8">
      <div
        v-for="branch in branchOrder"
        :key="branch"
        :class="['bg-slate-800 p-6 rounded-2xl border-2', branchMeta[branch].border]"
      >
        <h2 :class="['text-2xl font-bold mb-4 flex items-center gap-2', branchMeta[branch].title]">
          <span>{{ branchMeta[branch].icon }}</span> {{ branchMeta[branch].label }}
        </h2>
        <div class="overflow-x-auto">
          <svg
            :width="tierColumns(branch) * CELL_W + PAD * 2"
            :height="slotRows(branch) * CELL_H + PAD * 2"
            :viewBox="`0 0 ${tierColumns(branch) * CELL_W + PAD * 2} ${slotRows(branch) * CELL_H + PAD * 2}`"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              v-for="link in branchLinks(branch)"
              :key="link.key"
              :x1="link.x1" :y1="link.y1" :x2="link.x2" :y2="link.y2"
              :stroke="link.done ? '#22c55e' : '#475569'"
              :stroke-dasharray="link.done ? '' : '5,4'"
              stroke-width="2"
            />
            <foreignObject
              v-for="r in researchByBranch[branch]"
              :key="r.id"
              :x="nodePos(r).x - 100"
              :y="nodePos(r).y - 55"
              width="200"
              height="110"
            >
              <div xmlns="http://www.w3.org/1999/xhtml" :class="['h-full p-2 rounded-lg border flex flex-col gap-1', cardStateClass(r)]">
                <div class="flex items-center justify-between">
                  <p class="font-bold text-slate-100 text-xs leading-tight">{{ r.name }}</p>
                  <span v-if="hasResearch(r.id)" class="text-emerald-400 text-sm">✔</span>
                  <span v-else-if="!isResearchAvailable(r.id)" class="text-slate-500 text-sm">🔒</span>
                </div>
                <p class="text-[10px] text-slate-400 leading-tight flex-1">{{ r.description }}</p>
                <div class="flex items-center justify-between">
                  <span :class="['text-[10px] font-mono', r.cost.Gold !== undefined ? 'text-amber-400' : 'text-fuchsia-400']">{{ costLabel(r) }}</span>
                  <button
                    v-if="isResearchAvailable(r.id)"
                    @click="researchUnlock(r.id)"
                    :disabled="!canAfford(r)"
                    class="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 rounded text-[10px] font-bold"
                  >Research</button>
                </div>
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'tavern'" class="space-y-8">
      <!-- Tavern header / upgrade -->
      <div class="bg-slate-800 p-6 rounded-2xl border-2 border-amber-900/50">
        <div class="flex justify-between items-start gap-6">
          <div>
            <h2 class="text-3xl font-bold text-amber-400 flex items-center gap-2">
              🍺 {{ TAVERN_NAMES[store.buildings.Tavern] }}
            </h2>
            <p class="text-xs uppercase text-slate-500 mt-1">
              Level {{ store.buildings.Tavern }} / {{ TAVERN_MAX_LEVEL }}
              · Heroes {{ heroSlotsUsed() }} / {{ heroSlotsTotal() }}
            </p>
          </div>
          <div v-if="store.buildings.Tavern < TAVERN_MAX_LEVEL" class="flex flex-col items-end gap-1">
            <button
              @click="constructBuilding('Tavern')"
              :disabled="store.player.actionPoints < 1 || store.resources.Gold < effectiveBuildingCost(store.buildings.Tavern, 'Tavern').Gold || store.resources.Wood < effectiveBuildingCost(store.buildings.Tavern, 'Tavern').Wood || landSummary.used + effectiveBuildingLand('Tavern') > store.province.acres"
              class="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-30 rounded-lg text-sm font-bold transition-all"
            >
              Upgrade (1 AP)
            </button>
            <p class="text-[10px] text-slate-400 text-right">
              Next: <span class="text-amber-300">{{ TAVERN_NAMES[store.buildings.Tavern + 1] }}</span> ·
              +1 hero slot
            </p>
            <p class="text-[10px] text-slate-500">
              {{ effectiveBuildingCost(store.buildings.Tavern, 'Tavern').Gold }}g,
              {{ effectiveBuildingCost(store.buildings.Tavern, 'Tavern').Wood }}w ·
              Land: +{{ effectiveBuildingLand('Tavern') }}
            </p>
          </div>
          <div v-else class="text-amber-400 font-bold text-sm">⭐ Max level</div>
        </div>

        <!-- Hero slots -->
        <div class="mt-5 flex gap-2 flex-wrap">
          <div
            v-for="i in heroSlotsTotal()"
            :key="`slot-${i}`"
            :class="['w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl', heroAtSlot(i) ? 'bg-emerald-900/40 border-emerald-500' : 'bg-slate-900/50 border-dashed border-slate-700']"
            :title="heroAtSlot(i) ? HEROES[heroAtSlot(i)].name : 'Empty slot'"
          >
            <span v-if="heroAtSlot(i)">{{ HEROES[heroAtSlot(i)].icon }}</span>
            <span v-else class="text-slate-700">·</span>
          </div>
        </div>
      </div>

      <!-- Hero roster by rarity -->
      <div
        v-for="rarity in rarityOrder"
        :key="rarity"
        :class="['bg-slate-800 p-6 rounded-2xl border-2', rarityMeta[rarity].border]"
      >
        <h3 :class="['text-xl font-bold uppercase tracking-wide mb-4', rarityMeta[rarity].title]">
          <span :class="['inline-block w-2 h-2 rounded-full mr-2', rarityMeta[rarity].chip]"></span>
          {{ rarityMeta[rarity].label }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="h in heroesByRarity[rarity]"
            :key="h.id"
            :class="['p-3 rounded-lg border flex flex-col gap-2', hasHero(h.id) ? 'bg-emerald-900/30 border-emerald-500' : (canHireHero(h.id) ? 'bg-slate-900/80 border-amber-500/40' : 'bg-slate-900/30 border-slate-700 opacity-70')]"
          >
            <div class="flex items-start gap-2">
              <span class="text-2xl leading-none">{{ h.icon }}</span>
              <div class="flex-1">
                <p class="font-bold text-slate-100 text-sm leading-tight">{{ h.name }}</p>
                <p class="text-[11px] text-slate-400 leading-tight mt-0.5">{{ h.description }}</p>
              </div>
              <span v-if="hasHero(h.id)" class="text-emerald-400 text-lg">✔</span>
            </div>
            <div class="flex items-center justify-between mt-auto">
              <span class="text-[11px] font-mono">
                <span class="text-amber-400">{{ h.cost.Gold }}g</span>
                <span v-if="h.cost.Mana !== undefined" class="text-fuchsia-400 ml-1">+ {{ h.cost.Mana }}m</span>
              </span>
              <button
                v-if="hasHero(h.id)"
                @click="dismissHero(h.id)"
                class="px-2 py-1 bg-slate-700 hover:bg-rose-700 rounded text-[10px] font-bold transition-colors"
              >Dismiss</button>
              <button
                v-else-if="canHireHero(h.id)"
                @click="hireHero(h.id)"
                class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded text-[10px] font-bold"
              >Hire</button>
              <span v-else class="text-[10px] text-slate-500 italic">{{ heroBlockReason(h) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
