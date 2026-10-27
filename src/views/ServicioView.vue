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
  IconCalendar,
} from '@tabler/icons-vue'
import {
  listServicios,
  listClientes,
  createServicio,
  crearPagosPendientes,
  type Servicio,
  type Cliente,
} from '../api/pocketbase'
import { PERIOCIDAD_LABEL, fechasCuotas } from '../utils/cuotas'
import { formatDate } from '../utils/format'
import { showMontos, monto, montoVisible, toggleMontos } from '../utils/montos'
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
  num_cuotas: '1',
  estado: 'activo',
  fecha_inicio: '',
  fecha_final: '',
  observaciones: '',
})

/** Fechas de las cuotas que se crearán al guardar (cuota 1 = fecha inicio, 2 = +1 periocidad, …) */
const cuotasPreview = computed(() =>
  fechasCuotas(
    form.value.fecha_inicio,
    form.value.periocidad as Servicio['periocidad'],
    Number(form.value.num_cuotas) || 0,
  ),
)

/** Fecha final del servicio: la fecha de la última cuota */
const fechaFinalPreview = computed(() => {
  const fechas = cuotasPreview.value
  return fechas.length > 0 ? fechas[fechas.length - 1]! : ''
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
    num_cuotas: '1',
    estado: 'activo',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_final: '',
    observaciones: '',
  }
  actualizarFechaFinal()
  showForm.value = true
}

/** Mantiene fecha_final sincronizada con la fecha de la última cuota */
function actualizarFechaFinal() {
  form.value.fecha_final = fechaFinalPreview.value
}

// Si cambia la fecha de inicio, la periocidad o el número de cuotas, recalcular la fecha final
watch(
  [
    () => form.value.fecha_inicio,
    () => form.value.periocidad,
    () => form.value.num_cuotas,
  ],
  actualizarFechaFinal,
)

async function guardar() {
  if (!form.value.cliente_id || !form.value.servicio) return
  const fechas = cuotasPreview.value
  if (fechas.length === 0) {
    error.value = 'Indica al menos 1 cuota.'
    return
  }
  const fechaFinal = fechas[fechas.length - 1] ?? ''
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
      fecha_final: fechaFinal,
      observaciones: form.value.observaciones,
    })

    // Crear una cuota pendiente por cada fecha calculada (mismo monto en cada una)
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
            <input v-model="form.fecha_inicio" type="date" required />
          </label>
          <label>
            Num. cuotas *
            <input v-model="form.num_cuotas" type="number" min="1" step="1" required />
          </label>
        </div>

        <!-- Vista previa de las cuotas que se van a crear -->
        <div class="cuotas-preview">
          <div class="cuotas-head">
            <strong>
              {{
                cuotasPreview.length === 1
                  ? 'Se creará 1 cuota'
                  : `Se crearán ${cuotasPreview.length} cuotas`
              }}
            </strong>
            <span v-if="cuotasPreview.length > 0">
              Fecha final: {{ formatDate(fechaFinalPreview) }}
            </span>
          </div>

          <p v-if="cuotasPreview.length === 0" class="muted">
            Indica una fecha de inicio y al menos 1 cuota.
          </p>

          <template v-else>
            <ul class="cuotas-list">
              <li v-for="(fecha, i) in cuotasPreview" :key="`${i}-${fecha}`">
                <span class="cuota-num">Cuota {{ i + 1 }}</span>
                <span class="cuota-fecha">{{ formatDate(fecha) }}</span>
                <span class="cuota-monto">{{ montoVisible(Number(form.total) || 0) }}</span>
              </li>
            </ul>
            <div class="cuotas-total">
              <strong>Total a cobrar</strong>
              <strong>{{ montoVisible((Number(form.total) || 0) * cuotasPreview.length) }}</strong>
            </div>
          </template>
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
          <span class="cliente">
            <IconUser :size="14" />
            {{ clienteNombre(s.cliente_id) }}
          </span>
          <span class="periocidad">
            <IconCalendar :size="14" />
            {{ PERIOCIDAD_LABEL[s.periocidad] }}
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

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.periocidad {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  line-height: 1;
  color: var(--color-text-2);
}

.periocidad :deep(svg) {
  display: block;
  flex-shrink: 0;
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

/* Vista previa de cuotas en el formulario de nuevo servicio */
.cuotas-preview {
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  padding: 0.75rem;
  background: var(--color-background);
}

.cuotas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
}

.cuotas-head span {
  color: var(--color-text-2);
}

.cuotas-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 220px;
  overflow-y: auto;
}

.cuotas-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}

.cuotas-list li:last-child {
  border-bottom: none;
}

.cuota-num {
  flex: 1;
  font-weight: 600;
  color: var(--color-text-2);
}

.cuota-fecha {
  flex: 1;
}

.cuota-monto {
  font-weight: 600;
  color: var(--color-primary-dark);
}

.cuotas-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.4rem;
  padding-top: 0.4rem;
  border-top: 2px solid var(--color-border);
  font-size: 0.9rem;
}

.cuotas-total strong:last-child {
  color: var(--color-primary-dark);
}
</style>