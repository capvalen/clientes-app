<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IconId,
  IconBolt,
  IconUpload,
  IconRefresh,
  IconLoader,
  IconHistory,
  IconDatabasePlus,
  IconUserQuestion,
  IconCopy,
  IconTrash,
  IconEraser,
} from '@tabler/icons-vue'
import {
  alimentarDni,
  consultarDni,
  eliminarDniDesconocido,
  hasDniToken,
  listDnisDesconocidos,
  listUltimosDnis,
  type DniApiResult,
  type DniDesconocido,
  type DniUltimo,
} from '../api/dnis'
import { showToast } from '../utils/toast'
import { formatFechaHora } from '../utils/format'
import Breadcrumbs from '../components/Breadcrumbs.vue'

const form = ref({ dni: '', apellido: '', nombre: '' })
const dniInput = ref<HTMLInputElement | null>(null)

/** ¿Los tres inputs están vacíos? */
const formVacio = computed(
  () => !form.value.dni && !form.value.apellido && !form.value.nombre,
)

/** Limpia todos los inputs del formulario */
function limpiarFormulario() {
  form.value = { dni: '', apellido: '', nombre: '' }
  dniInput.value?.focus()
}

const cargandoAuto = ref(false)
const cargandoManual = ref(false)
const cargandoUltimos = ref(true)
const errorUltimos = ref('')
const ultimos = ref<DniUltimo[]>([])
/** Solo se muestran los últimos 5 DNIs */
const ULTIMOS_LIMITE = 5

const cargandoDesconocidos = ref(true)
const errorDesconocidos = ref('')
const desconocidos = ref<DniDesconocido[]>([])
/** DNI en proceso de eliminación (para deshabilitar su botón) */
const eliminando = ref<string | null>(null)

const RE_DNI = /^\d{8}$/

function dniValido(): boolean {
  if (RE_DNI.test(form.value.dni.trim())) return true
  showToast('El DNI debe tener 8 dígitos', 'error')
  return false
}

/** Solo los dígitos, máximo 8 (por si pegan el número con espacios) */
function limpiarDni() {
  form.value.dni = form.value.dni.replace(/\D/g, '').slice(0, 8)
}

/** Traduce el estado HTTP a una notificación */
function notificar(res: DniApiResult) {
  const dni = form.value.dni.trim()

  if (res.status === 200 || res.status === 201) {
    showToast(`DNI ${dni} registrado`, 'success')
    return
  }
  if (res.status === 404) {
    showToast(res.message || `DNI ${dni} no encontrado`, 'error')
    return
  }
  showToast(res.message || `Error ${res.status}`, 'error')
}

function avisoSinToken(): boolean {
  if (hasDniToken()) return false
  showToast('Falta configurar VITE_INFOCAT_DNI en el .env', 'error')
  return true
}

/** Rellena apellidos/nombres con lo que devuelva la consulta, si viene */
function rellenarConRespuesta(data: unknown) {
  if (!data || typeof data !== 'object') return
  const d = data as Record<string, unknown>

  // La API puede devolver el registro directo o dentro de `data`/`record`
  const registro =
    d.apellido || d.apellidos || d.nombre || d.nombres
      ? d
      : d.data && typeof d.data === 'object'
        ? (d.data as Record<string, unknown>)
        : d.record && typeof d.record === 'object'
          ? (d.record as Record<string, unknown>)
          : null

  if (!registro) return

  const apellido = registro.apellido ?? registro.apellidos
  const nombre = registro.nombre ?? registro.nombres
  if (typeof apellido === 'string' && apellido) form.value.apellido = apellido
  if (typeof nombre === 'string' && nombre) form.value.nombre = nombre
}

/** Botón Automático: consulta por DNI (GET /api/dni/{dni}/{token}) */
async function automatico() {
  if (avisoSinToken() || !dniValido()) return

  cargandoAuto.value = true
  try {
    const res = await consultarDni(form.value.dni)
    notificar(res)
    if (res.ok) {
      rellenarConRespuesta(res.data)
      await cargarListas()
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Error de conexión con el servicio', 'error')
  } finally {
    cargandoAuto.value = false
  }
}

/** Botón Manual: envía los tres datos (POST /api/alimentar/{token}) */
async function manual() {
  if (avisoSinToken() || !dniValido()) return

  if (!form.value.apellido.trim() || !form.value.nombre.trim()) {
    showToast('Completa apellidos y nombres para el registro manual', 'error')
    return
  }

  cargandoManual.value = true
  try {
    const res = await alimentarDni(form.value)
    notificar(res)
    if (res.ok) {
      form.value = { dni: '', apellido: '', nombre: '' }
      await cargarListas()
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Error de conexión con el servicio', 'error')
  } finally {
    cargandoManual.value = false
  }
}

/** Lista los últimos DNIs registrados */
async function cargarUltimos() {
  errorUltimos.value = ''

  if (!hasDniToken()) {
    ultimos.value = []
    cargandoUltimos.value = false
    errorUltimos.value = 'Falta configurar VITE_INFOCAT_DNI en el .env'
    return
  }

  cargandoUltimos.value = true
  try {
    const items = await listUltimosDnis()
    ultimos.value = items.slice(0, ULTIMOS_LIMITE)
  } catch (e) {
    errorUltimos.value = e instanceof Error ? e.message : 'Error al cargar los últimos DNIs'
  } finally {
    cargandoUltimos.value = false
  }
}

/** Lista los DNIs desconocidos (no identificados) */
async function cargarDesconocidos() {
  cargandoDesconocidos.value = true
  errorDesconocidos.value = ''
  try {
    desconocidos.value = await listDnisDesconocidos()
  } catch (e) {
    errorDesconocidos.value =
      e instanceof Error ? e.message : 'Error al cargar los DNIs desconocidos'
  } finally {
    cargandoDesconocidos.value = false
  }
}

/** Recarga ambas listas tras un registro correcto */
async function cargarListas() {
  await Promise.all([cargarUltimos(), cargarDesconocidos()])
}

/** Copia el DNI al portapapeles */
async function copiarDni(dni: string) {
  if (!dni) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(dni)
    } else {
      // Fallback para navegadores sin Clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = dni
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    showToast(`DNI ${dni} copiado`, 'success')
  } catch {
    showToast('No se pudo copiar el DNI', 'error')
  }
}

/** Elimina un DNI de la lista de desconocidos */
async function eliminarDesconocido(dni: string) {
  if (!dni || eliminando.value) return
  if (!confirm(`¿Eliminar el DNI ${dni} de desconocidos?`)) return

  eliminando.value = dni
  try {
    const res = await eliminarDniDesconocido(dni)
    if (res.ok) {
      showToast(`DNI ${dni} eliminado`, 'error')
      await cargarDesconocidos()
    } else {
      showToast(res.message || `Error ${res.status}`, 'error')
    }
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Error de conexión con el servicio', 'error')
  } finally {
    eliminando.value = null
  }
}

onMounted(() => {
  cargarUltimos()
  cargarDesconocidos()
})
</script>

<template>
  <main>
    <Breadcrumbs :items="[{ label: 'Proyecto DNIs' }]" />

    <div class="head">
      <h1><IconId :size="26" /> Proyecto DNIs</h1>
    </div>

    <section class="card">
      <h2><IconDatabasePlus :size="18" /> Alimentar información</h2>
      <p class="hint">
        <strong>Automático</strong> consulta el DNI en el servicio externo.
        <strong>Manual</strong> registra el DNI con los apellidos y nombres que escribas.
      </p>

      <form class="form" @submit.prevent="manual">
        <div class="grid">
          <label>
            DNI *
            <div class="input-with-action">
              <input
                ref="dniInput"
                v-model="form.dni"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                maxlength="8"
                required
                @input="limpiarDni"
              />
              <button
                type="button"
                class="clear-form"
                title="Limpiar todos los campos"
                aria-label="Limpiar todos los campos"
                :disabled="formVacio"
                @click="limpiarFormulario"
              >
                <IconEraser :size="15" />
              </button>
            </div>
          </label>
          <label>
            Apellidos *
            <input
              v-model="form.apellido"
              type="text"
              autocomplete="off"
            />
          </label>
          <label>
            Nombres *
            <input
              v-model="form.nombre"
              type="text"
              autocomplete="off"
            />
          </label>
        </div>

        <div class="row">
          <button
            type="button"
            class="primary"
            :disabled="cargandoAuto || cargandoManual"
            @click="automatico"
          >
            <IconLoader v-if="cargandoAuto" :size="18" class="spin" />
            <IconBolt v-else :size="18" />
            {{ cargandoAuto ? 'Consultando…' : 'Automático' }}
          </button>
          <button type="submit" class="ghost" :disabled="cargandoAuto || cargandoManual">
            <IconLoader v-if="cargandoManual" :size="18" class="spin" />
            <IconUpload v-else :size="18" />
            {{ cargandoManual ? 'Guardando…' : 'Manual' }}
          </button>
        </div>
      </form>
    </section>

    <div class="lists-row">
      <section class="card">
        <div class="card-head">
          <h2><IconHistory :size="18" /> Últimos DNIs</h2>
          <button
            type="button"
            class="ghost"
            :disabled="cargandoUltimos"
            @click="cargarUltimos"
          >
            <IconLoader v-if="cargandoUltimos" :size="16" class="spin" />
            <IconRefresh v-else :size="16" />
            Actualizar
          </button>
        </div>

        <p v-if="cargandoUltimos" class="muted">
          <IconLoader :size="16" class="spin" /> Cargando…
        </p>
        <p v-else-if="errorUltimos" class="error">{{ errorUltimos }}</p>
        <p v-else-if="ultimos.length === 0" class="muted">Aún no hay DNIs registrados.</p>

        <ul v-else class="dni-list">
          <li v-for="(item, i) in ultimos" :key="`${item.dni}-${i}`" class="dni-item">
            <span class="dni-badge">{{ item.dni || '—' }}</span>
            <div class="dni-data">
              <span class="dni-nombre">
                {{ item.apellido || '—' }}<template v-if="item.nombre">, {{ item.nombre }}</template>
              </span>
              <span v-if="item.fecha" class="dni-fecha">{{ formatFechaHora(item.fecha) }}</span>
            </div>
            <button
              type="button"
              class="copy-btn"
              title="Copiar DNI"
              :aria-label="`Copiar DNI ${item.dni}`"
              @click="copiarDni(item.dni)"
            >
              <IconCopy :size="15" /> Copiar
            </button>
          </li>
        </ul>
      </section>

      <section class="card">
        <div class="card-head">
          <h2><IconUserQuestion :size="18" /> DNIs desconocidos</h2>
          <button
            type="button"
            class="ghost"
            :disabled="cargandoDesconocidos"
            @click="cargarDesconocidos"
          >
            <IconLoader v-if="cargandoDesconocidos" :size="16" class="spin" />
            <IconRefresh v-else :size="16" />
            Actualizar
          </button>
        </div>

        <p v-if="cargandoDesconocidos" class="muted">
          <IconLoader :size="16" class="spin" /> Cargando…
        </p>
        <p v-else-if="errorDesconocidos" class="error">{{ errorDesconocidos }}</p>
        <p v-else-if="desconocidos.length === 0" class="muted">
          No hay DNIs desconocidos.
        </p>

        <ul v-else class="dni-list">
          <li
            v-for="item in desconocidos"
            :key="item.id ?? item.dni"
            class="dni-item"
          >
            <span class="dni-badge dni-badge--danger">{{ item.dni }}</span>
            <div class="dni-data">
              <span class="dni-nombre">No registrado</span>
            </div>
            <button
              type="button"
              class="copy-btn"
              title="Copiar DNI"
              :aria-label="`Copiar DNI ${item.dni}`"
              @click="copiarDni(item.dni)"
            >
              <IconCopy :size="15" /> Copiar
            </button>
            <button
              type="button"
              class="icon-btn"
              title="Eliminar DNI"
              :aria-label="`Eliminar DNI ${item.dni}`"
              :disabled="eliminando === item.dni"
              @click="eliminarDesconocido(item.dni)"
            >
              <IconLoader v-if="eliminando === item.dni" :size="15" class="spin" />
              <IconTrash v-else :size="15" />
            </button>
          </li>
        </ul>
      </section>
    </div>
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

.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: #ffffff;
  margin-top: 1rem;
}

/* En escritorio las dos listas van lado a lado; en móvil, una debajo de otra */
.lists-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  margin-top: 1rem;
  align-items: start;
}

.lists-row .card {
  margin-top: 0;
}

@media (min-width: 1024px) {
  .lists-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.card h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  margin: 0 0 0.75rem;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.card-head h2 {
  margin: 0;
}

.hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

input:focus {
  outline: none;
  border-color: hsl(var(--primary) / 0.6);
}

/* Input del DNI con su botón para limpiar todo el formulario */
.input-with-action {
  display: flex;
  align-items: stretch;
  gap: 0.3rem;
}

.input-with-action input {
  flex: 1;
  min-width: 0;
}

.clear-form {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background-soft);
  color: var(--color-text-2);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 0.15s,
    border-color 0.15s,
    background-color 0.15s;
}

.clear-form:hover:not(:disabled) {
  border-color: rgba(229, 72, 77, 0.4);
  background: rgba(229, 72, 77, 0.1);
  color: #e5484d;
}

.clear-form:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

button.ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dni-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dni-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: #ffffff;
}

.dni-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  background: hsl(var(--primary) / 0.14);
  color: var(--color-primary-dark);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

/* Solo para DNIs desconocidos */
.dni-badge--danger {
  border: 1px solid rgba(229, 72, 77, 0.28);
  background: rgba(229, 72, 77, 0.12);
  color: #b42318;
}

.dni-data {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.dni-nombre {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.dni-fecha {
  font-size: 0.78rem;
  color: var(--color-text-2);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: #ffffff;
  color: var(--color-text-2);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 0.15s,
    border-color 0.15s,
    background-color 0.15s;
}

.copy-btn:hover {
  border-color: hsl(var(--primary) / 0.5);
  background: hsl(var(--primary) / 0.08);
  color: var(--color-primary-dark);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.28rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: #ffffff;
  color: #e5484d;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 0.15s,
    border-color 0.15s,
    background-color 0.15s;
}

.icon-btn:hover:not(:disabled) {
  border-color: rgba(229, 72, 77, 0.45);
  background: rgba(229, 72, 77, 0.1);
  color: #e5484d;
}

.icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.muted {
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.error {
  color: #e5484d;
  font-size: 0.88rem;
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
