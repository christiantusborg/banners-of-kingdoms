<script setup lang="ts">
import { setRace, Race } from '../store/gameStore';

const races: { name: Race; desc: string; icon: string }[] = [
  { name: 'Human', desc: 'Versatile and ambitious. Start with Wood & Food + 2 extra.', icon: '🛡️' },
  { name: 'Elven', desc: 'Ancient and magical. Start with Food & Mana + 1 extra.', icon: '🍃' },
  { name: 'Dwarf', desc: 'Sturdy and industrious. Start with Food & Iron + 1 extra.', icon: '⚒️' },
  { name: 'Orc', desc: 'Strong and fierce. Start with Food + 1 extra.', icon: '🪓' },
];
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh]">
    <h1 class="text-4xl font-bold mb-8 text-amber-500">Choose Your Race</h1>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
      <div
        v-for="race in races"
        :key="race.name"
        @click="setRace(race.name)"
        class="bg-slate-800 border-2 border-slate-700 hover:border-amber-500 p-6 rounded-xl cursor-pointer transition-all transform hover:scale-105"
      >
        <div class="text-6xl mb-4 text-center">{{ race.icon }}</div>
        <h2 class="text-2xl font-bold mb-2 text-center">{{ race.name }}</h2>
        <p class="text-slate-400 text-sm text-center">{{ race.desc }}</p>
      </div>
    </div>
  </div>
</template>
