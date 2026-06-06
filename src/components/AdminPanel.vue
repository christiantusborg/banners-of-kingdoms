<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { store, vampirePrisoners } from '../store/gameStore';
import type { Resource } from '../store/gameStore';

// Frontend-only gate: hides the panel from casual players. This is NOT
// security — anyone can edit the store from devtools. Do not put anything
// sensitive behind it.
const ADMIN_PASSWORD = 'a-z';

const open = ref(false);
const unlocked = ref(false);
const password = ref('');
const badPassword = ref(false);
const amounts = reactive<Record<Resource, number>>({} as Record<Resource, number>);
const blood = ref(0);
const prisoners = ref(0);
const actionPoints = ref(0);
const MAX_AP = 999;

const isVampire = computed(() => store.player.race === 'Vampire');

const prefill = () => {
  for (const res of Object.keys(store.resources) as Resource[]) {
    amounts[res] = Math.floor(store.resources[res]);
  }
  blood.value = Math.floor(store.blood);
  prisoners.value = vampirePrisoners();
  actionPoints.value = Math.floor(store.player.actionPoints);
};

const toggle = () => {
  open.value = !open.value;
  if (open.value) {
    password.value = '';
    badPassword.value = false;
    if (unlocked.value) prefill();
  }
};

const submitPassword = () => {
  if (password.value === ADMIN_PASSWORD) {
    unlocked.value = true;
    badPassword.value = false;
    prefill();
  } else {
    badPassword.value = true;
  }
};

const apply = () => {
  for (const res of Object.keys(store.resources) as Resource[]) {
    const value = Number(amounts[res]);
    if (Number.isFinite(value) && value >= 0) {
      store.resources[res] = value;
    }
  }
  if (isVampire.value) {
    const bloodValue = Number(blood.value);
    if (Number.isFinite(bloodValue) && bloodValue >= 0) {
      store.blood = bloodValue;
    }
    const prisonerValue = Number(prisoners.value);
    if (Number.isFinite(prisonerValue) && prisonerValue >= 0) {
      // Prisoners are derived (population − ghouls − blooddolls − spies),
      // so set them by rebuilding population from the other three parts.
      const ghouls = Object.values(store.workers).reduce((acc, w) => acc + w.basic, 0);
      store.province.population =
        Math.floor(prisonerValue) + ghouls + store.blooddolls + store.player.spies;
    }
  }
  const ap = Number(actionPoints.value);
  if (Number.isFinite(ap) && ap >= 0) {
    // AP regen only counts UP toward maxActionPoints, never clamps down,
    // so values above the natural max (e.g. 999) stick until spent.
    store.player.actionPoints = Math.min(ap, MAX_AP);
  }
  // Resources aren't watched by autosave (they change every tick) — bump
  // actionVersion so the new amounts persist.
  store.actionVersion++;
  open.value = false;
};
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="text-xs text-slate-500 hover:text-slate-300 font-mono"
      title="Admin"
      @click="toggle"
    >
      (A)
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full mt-2 w-64 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl z-50"
    >
      <form v-if="!unlocked" @submit.prevent="submitPassword">
        <label class="block text-xs text-slate-400 mb-1" for="admin-password">Admin password</label>
        <input
          id="admin-password"
          v-model="password"
          type="password"
          autocomplete="off"
          class="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
        />
        <p v-if="badPassword" class="text-xs text-red-400 mt-1">Wrong password.</p>
        <button
          type="submit"
          class="mt-3 w-full rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium py-1.5"
        >
          Unlock
        </button>
      </form>

      <form v-else @submit.prevent="apply">
        <p class="text-xs text-slate-400 mb-2">Set resource amounts</p>
        <div
          v-for="res of Object.keys(store.resources)"
          :key="res"
          class="flex items-center justify-between gap-2 mb-2"
        >
          <label :for="`admin-res-${res}`" class="text-xs text-slate-300 w-12">{{ res }}</label>
          <input
            :id="`admin-res-${res}`"
            v-model.number="amounts[res as Resource]"
            type="number"
            min="0"
            class="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
          />
        </div>
        <div v-if="isVampire" class="flex items-center justify-between gap-2 mb-2">
          <label for="admin-res-Blood" class="text-xs text-red-300 w-12">Blood</label>
          <input
            id="admin-res-Blood"
            v-model.number="blood"
            type="number"
            min="0"
            class="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 text-right focus:outline-none focus:border-red-500"
          />
        </div>
        <div v-if="isVampire" class="flex items-center justify-between gap-2 mb-2">
          <label for="admin-prisoners" class="text-xs text-red-300 w-12" title="Sets population to prisoners + ghouls + blood dolls + spies">Prison.</label>
          <input
            id="admin-prisoners"
            v-model.number="prisoners"
            type="number"
            min="0"
            class="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 text-right focus:outline-none focus:border-red-500"
          />
        </div>
        <div class="flex items-center justify-between gap-2 mb-2 pt-2 border-t border-slate-800">
          <label for="admin-ap" class="text-xs text-amber-300 w-12" title="Action points (max 999)">AP</label>
          <input
            id="admin-ap"
            v-model.number="actionPoints"
            type="number"
            min="0"
            :max="MAX_AP"
            class="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100 text-right focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          class="mt-1 w-full rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium py-1.5"
        >
          Apply
        </button>
      </form>
    </div>
  </div>
</template>
