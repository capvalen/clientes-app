<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { IconPlus, IconLoader, IconFolder, IconEye, IconEyeOff, IconUser, IconFlag } from '@tabler/icons-vue'
import {
  listProyectos,
  createProyecto,
  createPago,
  listClientes,
  type Cliente,
  type Proyecto,
} from '../api/pocketbase'
import { truncate } from '../utils/format'
import { showMontos, monto, toggleMontos } from '../utils/montos'
import Modal from '../components/Modal.vue'
import MetodoPagoPicker from '../components/MetodoPagoPicker.vue'

const proyectos = ref<Proyecto[]>([])
const clientes = ref<Cliente[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const showForm = ref(false)

const form = ref({
  cliente_id: '',
  proyecto: '',
  descripcion: '',
  total: '',
  adelanto: '',
  estado: 'activo',
  fecha_inicio: '',
  fecha_final: '',
  observaciones: '',
})

const pagoForm = ref({
  monto: '',
  fecha: new Date().toISOString().slice(0, 10),
  metodo_pago: 'Efectivo',
  observaciones: '',
})
const comprobante = ref<File[]>([])

const clienteNombre = computed(() => {
  const map = new Map(clientes.value.map((c) => [c.id, c.nombre]))
  return (id: string) => map.get(id) || '—'
})

// Filtro por cliente ('' = todos)
const filtroCliente = ref('')

// Filtro por estado (por defecto: activos)
const filtroEstado = ref<Proyecto['estado']>('activo')

/** Clientes ordenados alfabéticamente para el selector */
const clientesOrdenados = computed(() =>
  [...clientes.value].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  ),
)

/** Proyectos visibles según el cliente y el estado seleccionados */
const proyectosFiltrados = computed(() =>
  proyectos.value.filter(
    (p) =>
      (!filtroCliente.value || p.cliente_id === filtroCliente.value) &&
      p.estado === filtroEstado.value,
  ),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [proy, cli] = await Promise.all([listProyectos(), listClientes()])
    proyectos.value = proy
    clientes.value = cli
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar proyectos'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openForm() {
  form.value = {
    cliente_id: clientes.value[0]?.id ?? '',
    proyecto: '',
    descripcion: '',
    total: '',
    adelanto: '',
    estado: 'activo',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_final: '',
    observaciones: '',
  }
  pagoForm.value = {
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    metodo_pago: 'Efectivo',
    observaciones: '',
  }
  comprobante.value = []
  showForm.value = true
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  comprobante.value = Array.from(input.files ?? [])
}

async function guardar() {
  if (!form.value.cliente_id || !form.value.proyecto) return
  saving.value = true
  error.value = ''
  try {
    // 1. Crear el proyecto
    const proyecto = await createProyecto({
      cliente_id: form.value.cliente_id,
      proyecto: form.value.proyecto,
      descripcion: form.value.descripcion,
      total: Number(form.value.total) || 0,
      adelanto: Number(form.value.adelanto) || 0,
      estado: form.value.estado as Proyecto['estado'],
      fecha_inicio: form.value.fecha_inicio,
      fecha_final: form.value.fecha_final,
      observaciones: form.value.observaciones,
    })

    // 2. Crear el pago inicial (pendiente) vinculado al proyecto
    const montoInicial = Number(pagoForm.value.monto) || Number(form.value.adelanto) || 0
    await createPago(
      {
        monto: montoInicial,
        adelanto: montoInicial,
        que_es: 'pago',
        fecha: pagoForm.value.fecha,
        estado: 'pendiente',
        metodo_pago: pagoForm.value.metodo_pago,
        observaciones: pagoForm.value.observaciones,
        entidad_id: proyecto.id,
        entidad_tipo: 'proyecto',
      },
      comprobante.value,
    )

    showForm.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar proyecto'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main>
    <div class="head">
      <h1>Proyectos</h1>
      <div class="head-actions">
        <button
          class="ghost"
          :title="showMontos ? 'Ocultar montos' : 'Ver montos'"
          @click="toggleMontos"
        >
          <IconEyeOff v-if="showMontos" :size="16" />
          <IconEye v-else :size="16" />
          {{ showMontos ? 'Ocultar montos' : 'Ver montos' }}
        </button>
        <button class="primary" @click="openForm">
          <IconPlus :size="18" />
          Nuevo proyecto
        </button>
      </div>
    </div>

    <Modal v-if="showForm" title="Nuevo proyecto" @close="showForm = false">
      <form class="form" @submit.prevent="guardar">
        <h3>Datos del proyecto</h3>
        <div class="grid">
          <label class="full">
            Cliente *
            <select v-model="form.cliente_id" required>
              <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </label>
          <label class="full">
            Proyecto *
            <input v-model="form.proyecto" type="text" required />
          </label>
          <label class="full">
            Descripción
            <textarea v-model="form.descripcion" rows="3"></textarea>
          </label>
          <label>
            Total (S/)
            <input v-model="form.total" type="number" min="0" step="0.01" />
          </label>
          <label>
            Adelanto (S/)
            <input v-model="form.adelanto" type="number" min="0" step="0.01" />
          </label>
          <label>
            Fecha inicio
            <input v-model="form.fecha_inicio" type="date" />
          </label>
          <label>
            Fecha final
            <input v-model="form.fecha_final" type="date" />
          </label>
          <label class="full">
            Observaciones
            <textarea v-model="form.observaciones" rows="2"></textarea>
          </label>
        </div>

        <h3>Pago inicial</h3>
        <div class="grid">
          <label>
            Monto (S/)
            <input v-model="pagoForm.monto" type="number" min="0" step="0.01" />
          </label>
          <label>
            Fecha
            <input v-model="pagoForm.fecha" type="date" />
          </label>
          <label>
            Estado
            <input :value="'Pendiente'" type="text" disabled />
          </label>
          <label class="full">
            Método de pago
            <MetodoPagoPicker v-model="pagoForm.metodo_pago" />
          </label>
          <label class="full">
            Comprobante (PDF o imagen)
            <input type="file" accept=".pdf,image/*" multiple @change="onFile" />
          </label>
          <label class="full">
            Observaciones
            <textarea v-model="pagoForm.observaciones" rows="2"></textarea>
          </label>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <div class="row">
          <button type="submit" class="primary" :disabled="saving">
            <IconLoader v-if="saving" :size="18" class="spin" />
            <IconPlus v-else :size="18" />
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
          <button type="button" class="ghost" @click="showForm = false">Cancelar</button>
        </div>
      </form>
    </Modal>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="filter-bar">
      <label class="filter-field">
        <IconUser :size="16" />
        Cliente
        <select v-model="filtroCliente" aria-label="Filtrar proyectos por cliente">
          <option value="">Todos los clientes</option>
          <option v-for="c in clientesOrdenados" :key="c.id" :value="c.id">
            {{ c.nombre }}
          </option>
        </select>
      </label>
      <label class="filter-field estado-field">
        <IconFlag :size="16" />
        Estado
        <select v-model="filtroEstado" aria-label="Filtrar proyectos por estado">
          <option value="activo">Activo</option>
          <option value="completado">Completado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </label>
      <span class="filter-count">
        {{ proyectosFiltrados.length }}
        {{ proyectosFiltrados.length === 1 ? 'proyecto' : 'proyectos' }}
      </span>
    </div>

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <p v-else-if="proyectos.length === 0" class="muted">
      <IconFolder :size="16" /> No hay proyectos registrados.
    </p>

    <div v-else-if="proyectosFiltrados.length === 0" class="empty-state">
      <IconFolder :size="32" />
      <span>No hay proyectos con los filtros seleccionados.</span>
    </div>

    <div v-else class="cards">
      <RouterLink
        v-for="p in proyectosFiltrados"
        :key="p.id"
        :to="`/proyecto/${p.id}`"
        class="card"
      >
        <div class="card-top">
          <strong class="card-name">{{ p.proyecto }}</strong>
        </div>
        <p v-if="p.descripcion" class="card-desc">{{ truncate(p.descripcion) }}</p>
        <div class="card-total">
          {{ monto(p.total) }}
        </div>
        <div class="card-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${Math.min(Number(p.progreso) || 0, 100)}%` }"
            ></div>
          </div>
          <span class="progress-label">{{ Number(p.progreso) || 0 }}%</span>
        </div>
        <div class="card-bottom">
          <span class="cliente">
            <IconUser :size="14" />
            {{ clienteNombre(p.cliente_id) }}
          </span>
        </div>
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* En celular: título arriba y acciones en una fila aparte,
   con "Nuevo" a la izquierda y "Ocultar/Ver montos" a la derecha */
@media (max-width: 1023px) {
  .head {
    flex-wrap: wrap;
  }

  .head-actions {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: space-between;
  }

  .head-actions .primary {
    order: -1;
  }
}

/* Filtro por cliente */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.filter-field select {
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
  min-width: 200px;
}

.estado-field select {
  min-width: 150px;
}

.filter-count {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

/* Estado vacío al filtrar */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: var(--color-text-2);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form h3 {
  font-size: 0.95rem;
  margin: 0.5rem 0 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--color-border);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.grid .full {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

input,
select,
textarea {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
  font-family: inherit;
}

textarea {
  resize: vertical;
}

.row {
  display: flex;
  gap: 0.5rem;
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

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: #ffffff;
  color: var(--color-text);
  text-decoration: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.card-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.card-total {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsl(160, 3.8%, 31%);
}

/* Barra de progreso con brillo animado en bucle */
.card-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--color-background-mute);
  overflow: hidden;
}

.progress-fill {
  position: relative;
  height: 100%;
  border-radius: 999px;
  background: var(--color-primary);
  overflow: hidden;
  transition: width 0.4s ease;
}

.progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: progress-shimmer 3s ease-in-out infinite;
}

.progress-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-2);
  min-width: 2.5rem;
  text-align: right;
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
  }
  60%,
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill::after {
    animation: none;
  }
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.cliente {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  color: #e5484d;
}

.muted {
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 0.4rem;
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