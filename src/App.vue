<script setup lang="ts">
import { store } from './store/gameStore';
import RaceSelector from './components/RaceSelector.vue';
import ResourceSelector from './components/ResourceSelector.vue';
import Dashboard from './components/Dashboard.vue';
import './style.css';
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
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
