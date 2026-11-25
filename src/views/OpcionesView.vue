<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IconKey,
  IconCheck,
  IconTrash,
  IconLock,
  IconShieldLock,
  IconPalette,
  IconCalculator,
  IconLoader,
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
import {
  PRECIO_HORA_DEFAULT,
  updateConfiguracion,
  type PesoCotizador,
} from '../api/pocketbase'
import {
  cargarPesosCotizador,
  savePesosCotizadorLocal,
} from '../utils/pesosCotizador'

/** Pestaña activa de la página de opciones */
type OpcionesTab = 'tema' | 'secretos' | 'pesos'

const route = useRoute()
const router = useRouter()

function tabFromQuery(value: unknown): OpcionesTab {
  const v = Array.isArray(value) ? value[0] : value
  if (v === 'secretos') return 'secretos'
  if (v === 'pesos') return 'pesos'
  return 'tema'
}

const activeTab = ref<OpcionesTab>(tabFromQuery(route.query.tab))

// Mantener la pestaña activa en la URL (permite enlazar a "Opciones > Secretos")
watch(activeTab, (t) => {
  if (route.query.tab !== t) {
    router.replace({ query: { ...route.query, tab: t } })
  }
})

// Si la URL cambia (ej. desde un enlace externo), sincronizar la pestaña
watch(
  () => route.query.tab,
  (value) => {
    const t = tabFromQuery(value)
    if (t !== activeTab.value) activeTab.value = t
  },
)

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

// ---- Pesos del cotizador (is_configuraciones) ----

const pesos = ref<PesoCotizador[]>([])
/** Precio por hora global para todas las actividades */
const precioHora = ref<number>(PRECIO_HORA_DEFAULT)
const pesoConfigId = ref<string | null>(null)
const cargandoPesos = ref(false)
const guardandoPesos = ref(false)
const pesosError = ref('')
const pesosOk = ref(false)
let pesosCargados = false

/** Carga la configuración del usuario; si no existe, la crea con los valores por defecto */
async function cargarPesos() {
  if (cargandoPesos.value || pesosCargados) return
  cargandoPesos.value = true
  pesosError.value = ''
  pesosOk.value = false
  try {
    // Consulta is_configuraciones; si no existe, inserta los valores por defecto
    const { configId, config } = await cargarPesosCotizador()
    pesoConfigId.value = configId
    pesos.value = config.pesos
    precioHora.value = config.precio_hora
    pesosCargados = true
  } catch (e) {
    pesosError.value = e instanceof Error ? e.message : 'Error al cargar los pesos'
  } finally {
    cargandoPesos.value = false
  }
}

async function guardarPesos() {
  if (!pesoConfigId.value) return
  guardandoPesos.value = true
  pesosError.value = ''
  pesosOk.value = false
  try {
    // Se guarda como string JSON en `valor` y se actualiza la copia local
    const config = {
      precio_hora: Number(precioHora.value) || 0,
      pesos: pesos.value,
    }
    await updateConfiguracion(pesoConfigId.value, config)
    savePesosCotizadorLocal(config)
    pesosOk.value = true
    showToast('Pesos guardados', 'success')
  } catch (e) {
    pesosError.value = e instanceof Error ? e.message : 'Error al guardar los pesos'
  } finally {
    guardandoPesos.value = false
  }
}

// Cargar al entrar en la pestaña (o si la URL ya apunta a ella)
watch(
  activeTab,
  (t) => {
    if (t === 'pesos') cargarPesos()
  },
  { immediate: true },
)
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
      <button
        id="tab-pesos"
        class="tab"
        :class="{ active: activeTab === 'pesos' }"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'pesos'"
        aria-controls="panel-pesos"
        @click="activeTab = 'pesos'"
      >
        <IconCalculator :size="16" /> Pesos del cotizador
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
      v-else-if="activeTab === 'secretos'"
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

    <section
      v-else
      id="panel-pesos"
      class="card"
      role="tabpanel"
      aria-labelledby="tab-pesos"
    >
      <h2><IconCalculator :size="18" /> Pesos del cotizador</h2>
      <p class="hint">
        Valores usados para evaluar las actividades del cotizador. Se guardan por usuario en la
        clave <code>pesos_cotizador</code> (valor en formato JSON). Si no existe el registro, se
        crea automáticamente con los valores por defecto.
      </p>

      <p v-if="cargandoPesos" class="estado">
        <IconLoader :size="16" class="spin" /> Cargando pesos…
      </p>

      <p v-if="pesosError" class="error">{{ pesosError }}</p>

      <template v-if="!cargandoPesos && pesos.length > 0">
        <!-- Enter en cualquier input guarda los pesos -->
        <form @submit.prevent="guardarPesos">
          <label class="precio-hora">
            Precio por hora (S/)
            <input v-model.number="precioHora" type="number" min="0" step="0.5" />
          </label>

          <table class="pesos">
            <thead>
              <tr>
                <th>Peso</th>
                <th>Descripción</th>
                <th>Horas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pesos" :key="item.peso">
                <td class="peso-valor">{{ item.peso }}</td>
                <td>{{ item.descripcion }}</td>
                <td class="peso-horas">
                  <input v-model.number="item.horas" type="number" step="0.5" />
                </td>
              </tr>
            </tbody>
          </table>

          <p class="hint nota">
            Usa <strong>-1</strong> en las horas para indicar que la actividad queda fuera de alcance
            normal y requiere análisis adicional. El precio por hora se aplica al total de horas del
            cotizador para calcular el costo estimado.
          </p>

          <div class="row">
            <button type="submit" class="primary" :disabled="guardandoPesos">
              <IconLoader v-if="guardandoPesos" :size="18" class="spin" />
              <IconCheck v-else :size="18" />
              {{ guardandoPesos ? 'Guardando…' : 'Guardar pesos' }}
            </button>
          </div>
        </form>
      </template>
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

.pesos {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.pesos th,
.pesos td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.pesos th {
  font-size: 0.8rem;
  color: var(--color-text-2);
  font-weight: 600;
}

.peso-valor {
  font-weight: 700;
  color: var(--color-primary-dark);
}

.peso-horas input {
  width: 6rem;
}

.precio-hora {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 220px;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.precio-hora input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
}

.nota {
  margin-top: 0.75rem;
}

.nota strong {
  font-weight: 700;
}

code {
  padding: 0.1rem 0.3rem;
  border-radius: 0.2rem;
  background: var(--color-background-mute);
  font-size: 0.85em;
}

.spin {
  animation: girar 1s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
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
