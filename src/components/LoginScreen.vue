<script setup lang="ts">
import { ref } from 'vue';
import { login, register, AuthError } from '../services/auth';

const emit = defineEmits<{ (e: 'authenticated'): void }>();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const displayName = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

const toggleMode = () => {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  error.value = null;
};

const submit = async () => {
  error.value = null;
  if (!email.value || !password.value) {
    error.value = 'Email and password are required.';
    return;
  }
  if (mode.value === 'register' && !displayName.value.trim()) {
    error.value = 'Display name is required.';
    return;
  }

  submitting.value = true;
  try {
    if (mode.value === 'login') {
      await login(email.value.trim(), password.value);
    } else {
      await register(displayName.value.trim(), email.value.trim(), password.value);
    }
    emit('authenticated');
  } catch (e) {
    error.value = e instanceof AuthError ? e.message : 'Network error. Try again.';
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <main class="max-w-md w-full p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl">
      <header class="mb-6">
        <h1 class="text-3xl font-bold tracking-tight">Banners of Kingdoms</h1>
        <p class="text-sm text-slate-400 mt-1">
          {{ mode === 'login' ? 'Sign in to your realm.' : 'Forge a new banner.' }}
        </p>
      </header>

      <form class="space-y-4" @submit.prevent="submit" novalidate>
        <div v-if="mode === 'register'">
          <label for="displayName" class="block text-sm font-medium mb-1">Display name</label>
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            autocomplete="nickname"
            minlength="3"
            maxlength="64"
            class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium mb-1">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium mb-1">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            required
            minlength="8"
            class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
          />
          <p v-if="mode === 'register'" class="mt-1 text-xs text-slate-500">
            At least 8 characters with a lowercase letter and a digit.
          </p>
        </div>

        <p
          v-if="error"
          class="text-sm text-red-400 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition"
        >
          {{ submitting ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <p class="mt-6 text-sm text-slate-400 text-center">
        {{ mode === 'login' ? 'New here?' : 'Already a ruler?' }}
        <button type="button" class="text-amber-400 hover:text-amber-300 underline" @click="toggleMode">
          {{ mode === 'login' ? 'Create an account' : 'Sign in instead' }}
        </button>
      </p>
    </main>
  </div>
</template>
