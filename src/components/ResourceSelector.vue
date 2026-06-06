<script setup lang="ts">
import { ref, computed } from 'vue';
import { store, RACE_CONFIG, Resource, startGame } from '../store/gameStore';

const race = computed(() => store.player.race!);
const config = computed(() => RACE_CONFIG[race.value]);

const selectedExtras = ref<Resource[]>([]);

const toggleResource = (res: Resource) => {
  const index = selectedExtras.value.indexOf(res);
  if (index > -1) {
    selectedExtras.value.splice(index, 1);
  } else if (selectedExtras.value.length < config.value.pickCount) {
    selectedExtras.value.push(res);
  }
};

const isSelected = (res: Resource) => selectedExtras.value.includes(res);
const canConfirm = computed(() => selectedExtras.value.length === config.value.pickCount);

const resourceIcons: Record<Resource, string> = {
  Food: '🍞',
  Gold: '💰',
  Mana: '🔮',
  Wood: '🪵',
  Iron: '⚒️',
};
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh]">
    <h1 class="text-4xl font-bold mb-4 text-amber-500">Starting Resources</h1>
    <p class="text-xl mb-8">As a {{ race }}, you start with <span class="text-amber-400 font-bold">{{ config.fixed.join(' & ') }}</span>.</p>
    
    <p v-if="config.pickCount > 0" class="mb-4 text-slate-300">
      Select {{ config.pickCount }} more resource{{ config.pickCount > 1 ? 's' : '' }}:
    </p>
    <p v-else class="mb-4 text-slate-300">
      Nothing else to pick — your race begins with every resource it can use.
    </p>

    <div v-if="config.availableExtra.length > 0" class="flex gap-4 mb-8">
      <div
        v-for="res in config.availableExtra"
        :key="res"
        @click="toggleResource(res)"
        :class="[
          'p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col items-center min-w-[100px]',
          isSelected(res) ? 'border-amber-500 bg-amber-500/10' : 'border-slate-700 bg-slate-800'
        ]"
      >
        <span class="text-3xl mb-2">{{ resourceIcons[res] }}</span>
        <span class="font-bold">{{ res }}</span>
      </div>
    </div>

    <button
      @click="startGame(selectedExtras)"
      :disabled="!canConfirm"
      class="px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors text-xl"
    >
      Begin Your Reign
    </button>
  </div>
</template>
