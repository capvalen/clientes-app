<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IconKey,
  IconCheck,
  IconTrash,
  IconLock,
  IconShieldLock,
  IconPalette,
} from '@tabler/icons-vue'
import {
  clearMasterPassword,
  hasMasterPassword,
  lockMaster,
  setMasterPassword,
  UNLOCK_MS,
} from '../utils/crypto'
import { showToast } from '../utils/toast'
import { THEMES, setTheme, theme } from '../utils/theme'
import Breadcrumbs from '../components/Breadcrumbs.vue'

/** Pestaña activa de la página de opciones */
const activeTab = ref<'tema' | 'secretos'>('tema')

const clave1 = ref('')
const clave2 = ref('')
const error = ref('')
const ok = ref(false)

/** ¿Ya existe una clave maestra creada en esta sesión? */
const existeClave = ref(hasMasterPassword())

const minutosDesbloqueo = Math.round(UNLOCK_MS / 60000)

const puedeGuardar = computed(() => clave1.value.length > 0 && clave2.value.length > 0)

function guardarClave() {
  error.value = ''
  ok.value = false
  if (clave1.value.length < 4) {
    error.value = 'La clave debe tener al menos 4 caracteres.'
    return
  }
  if (clave1.value !== clave2.value) {
    error.value = 'Las contraseñas no coinciden.'
    return
  }
  setMasterPassword(clave1.value)
  existeClave.value = true
  ok.value = true
  clave1.value = ''
  clave2.value = ''
}

function eliminarClave() {
  if (!confirm('¿Eliminar la clave maestra de esta sesión?')) return
  clearMasterPassword()
  existeClave.value = false
  ok.value = false
  error.value = ''
}

function bloquear() {
  lockMaster()
  error.value = ''
  ok.value = false
  showToast('Clave bloqueada', 'info')
}
</script>

<template>
  <main>
    <Breadcrumbs :items="[{ label: 'Opciones' }]" />

    <div class="head">
      <h1><IconShieldLock :size="26" /> Opciones</h1>
    </div>

    <div class="tabs" role="tablist" aria-label="Opciones">
      <button
        id="tab-tema"
        class="tab"
        :class="{ active: activeTab === 'tema' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'tema'"
        aria-controls="panel-tema"
        @click="activeTab = 'tema'"
      >
        <IconPalette :size="16" /> Tema
      </button>
      <button
        id="tab-secretos"
        class="tab"
        :class="{ active: activeTab === 'secretos' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'secretos'"
        aria-controls="panel-secretos"
        @click="activeTab = 'secretos'"
      >
        <IconKey :size="16" /> Secretos
      </button>
    </div>

    <section
      v-if="activeTab === 'tema'"
      id="panel-tema"
      class="card"
      role="tabpanel"
      aria-labelledby="tab-tema"
    >
      <h2><IconPalette :size="18" /> Color del tema</h2>
      <p class="hint">
        Elige el color primario de la aplicación. La preferencia se guarda en este navegador.
      </p>
      <div class="themes">
        <button
          v-for="t in THEMES"
          :key="t.id"
          type="button"
          class="theme-option"
          :class="{ active: theme === t.id }"
          :aria-pressed="theme === t.id"
          :title="t.label"
          @click="setTheme(t.id)"
        >
          <span class="swatch" :style="{ background: t.color }">
            <IconCheck v-if="theme === t.id" :size="18" />
          </span>
          <span class="theme-name">{{ t.label }}</span>
        </button>
      </div>
    </section>

    <section
      v-else
      id="panel-secretos"
      class="card"
      role="tabpanel"
      aria-labelledby="tab-secretos"
    >
      <h2><IconKey :size="18" /> Crear clave de secretos</h2>

      <p class="hint">
        La clave maestra cifra los secretos (AES-GCM). Se guarda solo en esta sesión
        del navegador. Al revelar un secreto, la clave queda desbloqueada
        {{ minutosDesbloqueo }} minutos y luego se vuelve a pedir.
      </p>

      <p v-if="existeClave" class="estado ok-estado">
        <IconCheck :size="16" /> Clave maestra activa en esta sesión.
      </p>
      <p v-else class="estado warn-estado">
        <IconLock :size="16" /> Aún no has creado una clave maestra.
      </p>

      <form class="form" @submit.prevent="guardarClave">
        <div class="grid">
          <label>
            Contraseña *
            <input v-model="clave1" type="password" autocomplete="new-password" required />
          </label>
          <label>
            Repetir contraseña *
            <input v-model="clave2" type="password" autocomplete="new-password" required />
          </label>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="ok" class="ok-msg"><IconCheck :size="16" /> Clave maestra guardada.</p>

        <div class="row">
          <button type="submit" class="primary" :disabled="!puedeGuardar">
            <IconKey :size="18" /> Guardar clave maestra
          </button>
          <button v-if="existeClave" type="button" class="ghost" @click="bloquear">
            <IconLock :size="18" /> Bloquear ahora
          </button>
          <button v-if="existeClave" type="button" class="danger" @click="eliminarClave">
            <IconTrash :size="18" /> Eliminar clave
          </button>
        </div>
      </form>
    </section>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.head h1 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.5rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-top: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  margin-bottom: -1px;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0.35rem 0.35rem 0 0;
  color: var(--color-text-2);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s,
    border-color 0.15s;
}

.tab:hover {
  color: var(--color-text);
  background: var(--color-background-mute);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.themes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem;
  padding: 0.75rem 0.9rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.theme-option:hover {
  border-color: var(--color-primary);
}

.theme-option.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
}

.swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  color: #ffffff;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.theme-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: #ffffff;
  margin-top: 1rem;
}

.card h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  margin: 0 0 0.75rem;
}

.hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.estado {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.ok-estado {
  color: #1a7f37;
  background: rgba(46, 160, 67, 0.12);
}

.warn-estado {
  color: #9a6700;
  background: rgba(255, 171, 0, 0.14);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
  font-family: inherit;
}

.row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: 0;
  border-radius: 0.25rem;
  cursor: pointer;
}

button.primary {
  background: var(--color-primary);
  color: var(--color-background);
}

button.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button.ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

button.danger {
  background: transparent;
  border: 1px solid rgba(229, 72, 77, 0.4);
  color: #e5484d;
}

button.danger:hover {
  background: rgba(229, 72, 77, 0.1);
}

.error {
  color: #e5484d;
}

.ok-msg {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #1a7f37;
  font-weight: 600;
}
</style>
