<script setup lang="ts">
import { reactive, ref } from 'vue';
import { store } from '../store/gameStore';
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

const prefill = () => {
  for (const res of Object.keys(store.resources) as Resource[]) {
    amounts[res] = Math.floor(store.resources[res]);
  }
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
