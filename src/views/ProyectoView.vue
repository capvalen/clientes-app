<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { IconPlus, IconLoader, IconFolder, IconEye, IconEyeOff, IconUser } from '@tabler/icons-vue'
import {
  listProyectos,
  createProyecto,
  createPago,
  listClientes,
  METODOS_PAGO,
  type Cliente,
  type Proyecto,
} from '../api/pocketbase'
import { truncate } from '../utils/format'
import Modal from '../components/Modal.vue'

const proyectos = ref<Proyecto[]>([])
const clientes = ref<Cliente[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const showForm = ref(false)
const showMontos = ref(false)

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
const comprobante = ref<File | null>(null)

const clienteNombre = computed(() => {
  const map = new Map(clientes.value.map((c) => [c.id, c.nombre]))
  return (id: string) => map.get(id) || '—'
})

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
  comprobante.value = null
  showForm.value = true
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  comprobante.value = input.files?.[0] ?? null
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
    await createPago(
      {
        monto: Number(pagoForm.value.monto) || Number(form.value.adelanto) || 0,
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
          @click="showMontos = !showMontos"
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
          <label>
            Método de pago
            <select v-model="pagoForm.metodo_pago">
              <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <label class="full">
            Comprobante (PDF o imagen)
            <input type="file" accept=".pdf,image/*" @change="onFile" />
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

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <p v-else-if="proyectos.length === 0" class="muted">
      <IconFolder :size="16" /> No hay proyectos registrados.
    </p>

    <div v-else class="cards">
      <RouterLink
        v-for="p in proyectos"
        :key="p.id"
        :to="`/proyecto/${p.id}`"
        class="card"
      >
        <div class="card-top">
          <strong class="card-name">{{ p.proyecto }}</strong>
        </div>
        <p v-if="p.descripcion" class="card-desc">{{ truncate(p.descripcion) }}</p>
        <div class="card-total">
          {{ showMontos ? `S/ ${Number(p.total || 0).toFixed(2)}` : 'S/ ••••' }}
        </div>
        <div class="card-bottom">
          <span class="badge" :class="p.estado">{{ p.estado }}</span>
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
  background: hsla(160, 100%, 37%, 1);
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
  background: var(--color-background-soft);
  color: var(--color-text);
  text-decoration: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  border-color: hsla(160, 100%, 37%, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-name {
  font-size: 1rem;
  font-weight: 700;
}

.card-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.card-total {
  font-size: 1.5rem;
  font-weight: 700;
  color: hsla(160, 100%, 30%, 1);
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

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  flex-shrink: 0;
}

.badge.activo {
  background: rgba(46, 160, 67, 0.15);
  color: #1a7f37;
}

.badge.completado {
  background: rgba(9, 105, 218, 0.15);
  color: #0969da;
}

.badge.cancelado {
  background: rgba(229, 72, 77, 0.15);
  color: #e5484d;
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