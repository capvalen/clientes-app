<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  IconPlus,
  IconLoader,
  IconTools,
  IconUser,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-vue'
import {
  listServicios,
  listClientes,
  createServicio,
  crearPagosPendientes,
  type Servicio,
  type Cliente,
} from '../api/pocketbase'
import { PERIOCIDAD_LABEL, calcularCuotas, sumarPeriocidad } from '../utils/cuotas'
import { formatDate } from '../utils/format'
import { showMontos, monto, toggleMontos } from '../utils/montos'
import Modal from '../components/Modal.vue'

const router = useRouter()

const servicios = ref<Servicio[]>([])
const clientes = ref<Cliente[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const showForm = ref(false)

const form = ref({
  cliente_id: '',
  servicio: '',
  descripcion: '',
  total: '',
  periocidad: 'mensual',
  duracion_dias: '0',
  estado: 'activo',
  fecha_inicio: '',
  fecha_final: '',
  observaciones: '',
})

const clienteNombre = computed(() => {
  const map = new Map(clientes.value.map((c) => [c.id, c.nombre]))
  return (id: string) => map.get(id) || '—'
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [serv, cli] = await Promise.all([listServicios(), listClientes()])
    servicios.value = serv
    clientes.value = cli
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar servicios'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openForm() {
  form.value = {
    cliente_id: clientes.value[0]?.id ?? '',
    servicio: '',
    descripcion: '',
    total: '',
    periocidad: 'mensual',
    duracion_dias: '0',
    estado: 'activo',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_final: '',
    observaciones: '',
  }
  // Calcular la fecha final automáticamente
  form.value.fecha_final = sumarPeriocidad(form.value.fecha_inicio, form.value.periocidad as Servicio['periocidad'])
  showForm.value = true
}

// Calcular vista previa de pagos pendientes
function calcularPagosPreview() {
  if (!form.value.fecha_inicio || !form.value.fecha_final || !form.value.periocidad) {
    return []
  }
  return calcularCuotas(form.value.fecha_inicio, form.value.fecha_final, form.value.periocidad as Servicio['periocidad'])
}

// Si cambia la periocidad, fecha de inicio o total, recalcular la fecha final
watch(
  [() => form.value.fecha_inicio, () => form.value.periocidad, () => form.value.total],
  () => {
    if (form.value.fecha_inicio) {
      form.value.fecha_final = sumarPeriocidad(
        form.value.fecha_inicio,
        form.value.periocidad as Servicio['periocidad'],
      )
    }
  },
)

async function guardar() {
  if (!form.value.cliente_id || !form.value.servicio) return
  saving.value = true
  error.value = ''
  try {
    const servicio = await createServicio({
      cliente_id: form.value.cliente_id,
      servicio: form.value.servicio,
      descripcion: form.value.descripcion,
      total: Number(form.value.total) || 0,
      periocidad: form.value.periocidad as Servicio['periocidad'],
      duracion_dias: Number(form.value.duracion_dias) || 0,
      estado: form.value.estado as Servicio['estado'],
      fecha_inicio: form.value.fecha_inicio,
      fecha_final: form.value.fecha_final,
      observaciones: form.value.observaciones,
    })

    // Crear los pagos pendientes entre el período (mismo monto en cada fecha)
    const fechas = calcularCuotas(
      servicio.fecha_inicio,
      servicio.fecha_final,
      servicio.periocidad,
    )
    await crearPagosPendientes(servicio.id, fechas, Number(servicio.total) || 0)

    showForm.value = false
    router.push(`/servicio/${servicio.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar servicio'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main>
    <div class="head">
      <h1>Servicios</h1>
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
          <IconPlus :size="18" /> Nuevo servicio
        </button>
      </div>
    </div>

    <Modal v-if="showForm" title="Nuevo servicio" @close="showForm = false">
      <form class="form" @submit.prevent="guardar">
        <div class="grid">
          <label class="full">
            Cliente *
            <select v-model="form.cliente_id" required>
              <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </label>
          <label class="full">
            Servicio *
            <input v-model="form.servicio" type="text" required />
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
            Periocidad
            <select v-model="form.periocidad">
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="bianual">Bianual</option>
              <option value="anual">Anual</option>
            </select>
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

        <!-- Vista previa de pagos pendientes -->
        <div v-if="form.fecha_inicio && form.fecha_final && form.periocidad" class="pagos-preview">
          <h3>Pagos pendientes a crear ({{ calcularPagosPreview().length }})</h3>
          <p v-if="calcularPagosPreview().length === 0" class="muted">
            Sin pagos — ajusta las fechas para generar el plan de pagos.
          </p>
          <ul v-else class="pagos-list">
            <li v-for="(fecha, i) in calcularPagosPreview()" :key="fecha" class="pago-item">
              <span class="pago-num">#{{ i + 1 }}</span>
              <span class="pago-fecha">{{ formatDate(fecha) }}</span>
              <span class="pago-monto">S/ {{ Number(form.total || 0).toFixed(2) }}</span>
              <span class="pago-estado pendiente">Pendiente</span>
            </li>
          </ul>
          <div class="pagos-total">
            <strong>Total a cobrar: S/ {{ (Number(form.total || 0) * calcularPagosPreview().length).toFixed(2) }}</strong>
          </div>
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

    <p v-else-if="servicios.length === 0" class="muted">
      <IconTools :size="16" /> No hay servicios registrados.
    </p>

    <div v-else class="cards">
      <RouterLink
        v-for="s in servicios"
        :key="s.id"
        :to="`/servicio/${s.id}`"
        class="card"
      >
        <div class="card-top">
          <strong class="card-name">{{ s.servicio }}</strong>
        </div>
        <p v-if="s.descripcion" class="card-desc">{{ s.descripcion }}</p>
        <div class="card-total">
          {{ monto(s.total) }}
        </div>
        <div class="card-bottom">
          <span class="badge" :class="s.estado">{{ s.estado }}</span>
          <span class="cliente">
            <IconUser :size="14" />
            {{ clienteNombre(s.cliente_id) }}
          </span>
          <span class="periocidad">{{ PERIOCIDAD_LABEL[s.periocidad] }}</span>
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
  background: #ffffff;
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
  color: hsla(160, 100%, 30%, 1);
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

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.activo {
  background: rgba(46, 160, 67, 0.15);
  color: #1a7f37;
}

.badge.inactivo {
  background: rgba(110, 118, 129, 0.15);
  color: #6e7781;
}

.badge.suspendido {
  background: rgba(229, 72, 77, 0.15);
  color: #e5484d;
}

.periocidad {
  font-size: 0.8rem;
  color: var(--color-text-2);
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

/* Vista previa de pagos pendientes */
.pagos-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}

.pagos-preview h3 {
  margin: 0 0 0.75rem 0;
  font-size: 0.95rem;
  color: var(--color-text);
}

.pagos-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.pago-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}

.pago-item:last-child {
  border-bottom: none;
}

.pago-num {
  font-weight: 600;
  color: var(--color-text-2);
  min-width: 2rem;
}

.pago-fecha {
  flex: 1;
  color: var(--color-text);
}

.pago-monto {
  font-weight: 600;
  color: hsla(160, 100%, 30%, 1);
}

.pago-estado {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.pago-estado.pendiente {
  background: rgba(154, 103, 0, 0.15);
  color: #9a6700;
}

.pagos-total {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  text-align: right;
  font-size: 0.9rem;
}
</style>