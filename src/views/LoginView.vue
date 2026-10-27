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
    <div class="login-bg"></div>
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <div class="brand-icon">
          <img src="/icon-512.png" alt="Deal Desk" />
        </div>
        <h1>Deal Desk</h1>
        <p class="subtitle">Gestión de contratos y proyectos</p>
      </div>

      <div class="form-group">
        <label for="identity">Correo</label>
        <div class="input-wrapper">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input id="identity" v-model="identity" type="text" autocomplete="username" required placeholder="tucorreo@email.com" />
        </div>
      </div>

      <div class="form-group">
        <label for="password">Contraseña</label>
        <div class="input-wrapper">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        <IconLoader v-if="loading" :size="18" class="spin" />
        <IconLogin v-else :size="18" />
        {{ loading ? 'Ingresando…' : 'Entrar' }}
      </button>

      <p class="footer-text">Sistema de Mesa de contratos © {{ new Date().getFullYear() }}</p>
    </form>
  </main>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  grid-column: 1 / -1;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, hsl(var(--primary) / 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, hsl(var(--primary) / 0.05) 0%, transparent 50%);
  z-index: 0;
}

.login-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 500px;
  padding: 2.5rem 2rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 20px 50px -12px rgba(0, 0, 0, 0.1);
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
}

.brand-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.login-brand h1 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.login-brand .subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.01em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  width: 18px;
  height: 18px;
  color: #94a3b8;
  pointer-events: none;
  transition: color 0.2s ease;
}

.input-wrapper:focus-within .input-icon {
  color: var(--color-primary-dark);
}

input {
  width: 100%;
  padding: 0.7rem 0.75rem 0.7rem 2.5rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #f8fafc;
  color: #1e293b;
  font-size: 0.9rem;
  font-family: inherit;
  transition: all 0.2s ease;
  outline: none;
}

input::placeholder {
  color: #cbd5e1;
}

input:focus {
  border-color: var(--color-primary);
  background: #ffffff;
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
}

button {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #4b5563 0%, #1f2937 100%);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(17, 24, 39, 0.35);
  letter-spacing: 0.01em;
}

/* Brillo que recorre el botón */
button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -75%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(255, 255, 255, 0.38) 50%,
    transparent 100%
  );
  transform: skewX(-20deg);
  animation: boton-brillo 3.6s ease-in-out infinite;
  pointer-events: none;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(17, 24, 39, 0.5);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button:disabled::before {
  animation: none;
}

@keyframes boton-brillo {
  0% {
    left: -75%;
  }
  50%,
  100% {
    left: 125%;
  }
}

@media (prefers-reduced-motion: reduce) {
  button::before {
    animation: none;
  }
}

.error {
  color: #e5484d;
  font-size: 0.85rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.4rem;
  background: rgba(229, 72, 77, 0.08);
  border: 1px solid rgba(229, 72, 77, 0.15);
}

.footer-text {
  text-align: center;
  font-size: 0.75rem;
  color: #cbd5e1;
  margin: 0;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .login-card {
    margin: 1rem;
    padding: 1.5rem 1.25rem;
  }

  .login-brand h1 {
    font-size: 1.1rem;
  }

  .brand-icon {
    width: 52px;
    height: 52px;
    border-radius: 13px;
  }
}
</style>