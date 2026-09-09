<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IconLogin, IconLoader } from '@tabler/icons-vue'
import { login } from '../api/pocketbase'

const route = useRoute()
const router = useRouter()

const identity = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await login(identity.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/cliente'
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="login-card" @submit.prevent="submit">
      <h1>Iniciar sesión</h1>

      <label>
        Email o usuario
        <input v-model="identity" type="text" autocomplete="username" required />
      </label>

      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        <IconLoader v-if="loading" :size="18" class="spin" />
        <IconLogin v-else :size="18" />
        {{ loading ? 'Ingresando…' : 'Entrar' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 360px;
  padding: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-background-soft);
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border: 0;
  border-radius: 0.25rem;
  background: hsla(160, 100%, 37%, 1);
  color: var(--color-background);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e5484d;
  font-size: 0.9rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>