<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import {
  IconBuilding,
  IconBuildingBank,
  IconCamera,
  IconCheck,
  IconClock,
  IconCoin,
  IconDeviceMobile,
  IconEdit,
  IconLoader,
  IconPaperclip,
  IconPhone,
  IconPlus,
  IconTrash,
  IconWallet,
  IconX,
} from '@tabler/icons-vue'
import {
  getProyecto,
  getCliente,
  updateProyecto,
  deleteProyecto,
  listPagosPorEntidad,
  createPago,
  updatePago,
  deletePago,
  getComprobanteUrl,
  getToken,
  METODOS_PAGO,
  type Proyecto,
  type Pago,
  type Cliente,
} from '../api/pocketbase'
import { capitalize, formatDate, formatDateTime } from '../utils/format'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import Modal from '../components/Modal.vue'
import DropzoneFile from '../components/DropzoneFile.vue'

const router = useRouter()
const route = useRoute()
const id = route.params.id as string

const proyecto = ref<Proyecto | null>(null)
const cliente = ref<Cliente | null>(null)
const pagos = ref<Pago[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const crumbs = computed(() => [
  { label: 'Clientes', to: '/cliente' },
  { label: cliente.value?.nombre ?? '…', to: cliente.value ? `/cliente/${cliente.value.id}` : undefined },
  { label: proyecto.value?.proyecto ?? '…' },
])

// Edición de campos primarios
const editing = ref(false)
const editForm = ref({
  proyecto: '',
  descripcion: '',
  total: '',
  adelanto: '',
  progreso: '',
  estado: 'activo',
  fecha_inicio: '',
  fecha_final: '',
  observaciones: '',
})

function startEdit() {
  if (!proyecto.value) return
  editForm.value = {
    proyecto: proyecto.value.proyecto ?? '',
    descripcion: proyecto.value.descripcion ?? '',
    total: String(proyecto.value.total ?? ''),
    adelanto: String(proyecto.value.adelanto ?? ''),
    progreso: String(proyecto.value.progreso ?? ''),
    estado: proyecto.value.estado ?? 'activo',
    fecha_inicio: proyecto.value.fecha_inicio ?? '',
    fecha_final: proyecto.value.fecha_final ?? '',
    observaciones: proyecto.value.observaciones ?? '',
  }
  editing.value = true
}

async function saveEdit() {
  if (!proyecto.value) return
  saving.value = true
  error.value = ''
  try {
    proyecto.value = await updateProyecto(proyecto.value.id, {
      proyecto: editForm.value.proyecto,
      descripcion: editForm.value.descripcion,
      total: Number(editForm.value.total) || 0,
      adelanto: Number(editForm.value.adelanto) || 0,
      progreso: Number(editForm.value.progreso) || 0,
      estado: editForm.value.estado as Proyecto['estado'],
      fecha_inicio: editForm.value.fecha_inicio,
      fecha_final: editForm.value.fecha_final,
      observaciones: editForm.value.observaciones,
    })
    editing.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function eliminarProyecto() {
  if (!proyecto.value) return
  if (!confirm(`¿Eliminar el proyecto "${proyecto.value.proyecto}"?`)) return
  saving.value = true
  error.value = ''
  try {
    await deleteProyecto(proyecto.value.id)
    router.push('/proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar proyecto'
    saving.value = false
  }
}

const ESTADO_PAGO: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#9a6700', bg: '#fff8c5' },
  pagado: { label: 'Pagado', color: '#1a7f37', bg: '#dafbe1' },
  anulado: { label: 'Anulado', color: '#e5484d', bg: '#ffebe9' },
}

const METODO_PAGO_INFO: Record<string, { color: string; bg: string; icon: unknown }> = {
  Efectivo: { color: '#1a7f37', bg: '#dafbe1', icon: IconCoin },
  Yape: { color: '#0969da', bg: '#ddf4ff', icon: IconDeviceMobile },
  Plin: { color: '#8250df', bg: '#fbefff', icon: IconPhone },
  BCP: { color: '#e5484d', bg: '#ffebe9', icon: IconBuildingBank },
  'Caja Huancayo': { color: '#9a6700', bg: '#fff8c5', icon: IconBuilding },
}

function metodoInfo(metodo: string) {
  return (
    METODO_PAGO_INFO[metodo] ?? {
      color: '#6e7781',
      bg: '#eaeef2',
      icon: IconCoin,
    }
  )
}

function pagoInfo(estado: string) {
  return ESTADO_PAGO[estado] ?? { label: estado, color: '#6e7781', bg: '#eaeef2' }
}

/** Indica si el comprobante es una imagen (por extensión) */
function esImagen(nombre: string | undefined): boolean {
  if (!nombre) return false
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(nombre)
}

// Primer adelanto
const showPagoForm = ref(false)
const pagoForm = ref({
  monto: '',
  metodo_pago: 'Efectivo',
  observaciones: '',
})
const comprobante = ref<File | null>(null)

// Agregar deuda
const showDeudaForm = ref(false)
const deudaForm = ref({ monto: '', observaciones: '' })

function openDeudaForm() {
  deudaForm.value = { monto: '', observaciones: '' }
  showDeudaForm.value = true
}

async function guardarDeuda() {
  if (!proyecto.value || !deudaForm.value.monto) return
  saving.value = true
  error.value = ''
  try {
    const monto = Number(deudaForm.value.monto) || 0

    // 1. Sumar la deuda al total del proyecto
    const updated = await updateProyecto(proyecto.value.id, {
      total: (Number(proyecto.value.total) || 0) + monto,
    })
    proyecto.value = updated

    // 2. Crear el pago pendiente con las observaciones
    await createPago({
      monto,
      fecha: new Date().toISOString().slice(0, 10), // fecha de hoy
      estado: 'pendiente',
      metodo_pago: 'Efectivo',
      observaciones: deudaForm.value.observaciones,
      entidad_id: proyecto.value.id,
      entidad_tipo: 'proyecto',
    })

    showDeudaForm.value = false
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar deuda'
  } finally {
    saving.value = false
  }
}

// Detalle de pago
const selectedPago = ref<Pago | null>(null)
const comprobanteUrl = ref<string | null>(null)
const ticketRef = ref<HTMLElement | null>(null)
const capturando = ref(false)

// Modal de pagos pendientes
const showPendientes = ref(false)

const pagosPendientes = computed(() =>
  pagos.value.filter((p) => p.estado === 'pendiente'),
)

// Edición de pago
const editingPago = ref<Pago | null>(null)
const pagoEditForm = ref({
  monto: '',
  fecha: '',
  estado: 'pendiente',
  metodo_pago: 'Efectivo',
  observaciones: '',
})
const nuevoComprobante = ref<File | null>(null)

function openPagoEdit(pago: Pago) {
  pagoEditForm.value = {
    monto: String(pago.monto ?? ''),
    fecha: (pago.fecha ?? '').slice(0, 10),
    estado: pago.estado ?? 'pendiente',
    metodo_pago: pago.metodo_pago || 'Efectivo',
    observaciones: pago.observaciones ?? '',
  }
  nuevoComprobante.value = null
  editingPago.value = pago
}

async function savePagoEdit() {
  if (!editingPago.value) return
  saving.value = true
  error.value = ''
  try {
    await updatePago(
      editingPago.value.id,
      {
        monto: Number(pagoEditForm.value.monto) || 0,
        fecha: pagoEditForm.value.fecha,
        estado: pagoEditForm.value.estado as Pago['estado'],
        metodo_pago: pagoEditForm.value.metodo_pago,
        observaciones: pagoEditForm.value.observaciones,
      },
      nuevoComprobante.value,
    )
    editingPago.value = null
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar pago'
  } finally {
    saving.value = false
  }
}

async function eliminarPago() {
  if (!editingPago.value) return
  if (!confirm('¿Eliminar este pago?')) return
  saving.value = true
  error.value = ''
  try {
    await deletePago(editingPago.value.id)
    editingPago.value = null
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar pago'
  } finally {
    saving.value = false
  }
}

function onEditFileChange(f: File | null) {
  nuevoComprobante.value = f
}

function openPagoDetalle(pago: Pago) {
  selectedPago.value = pago
  try {
    comprobanteUrl.value = getComprobanteUrl(pago)
  } catch {
    comprobanteUrl.value = null
  }
}

async function capturarTicket() {
  const el = ticketRef.value
  if (!el || !selectedPago.value) return
  capturando.value = true
  try {
    // Convertir la miniatura a dataURL para evitar el bloqueo cross-origin del canvas
    const img = el.querySelector('img.thumb') as HTMLImageElement | null
    let originalSrc: string | null = null
    if (img && img.src) {
      originalSrc = img.src
      try {
        const headers: Record<string, string> = {}
        const token = getToken()
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(img.src, { headers })
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
          reader.readAsDataURL(blob)
        })
        img.src = dataUrl
        await new Promise((r) => setTimeout(r, 100)) // esperar a que cargue el dataURL
      } catch {
        // si falla, se captura sin la imagen
      }
    }

    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })

    if (img && originalSrc) img.src = originalSrc

    const link = document.createElement('a')
    link.download = `pago-${selectedPago.value.id}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al capturar el ticket'
  } finally {
    capturando.value = false
  }
}

function openPagoForm() {
  pagoForm.value = {
    monto: '',
    metodo_pago: 'Efectivo',
    observaciones: '',
  }
  comprobante.value = null
  showPagoForm.value = true
}

function onFileChange(f: File | null) {
  comprobante.value = f
}

async function guardarPago() {
  if (!proyecto.value || !pagoForm.value.monto) return
  saving.value = true
  error.value = ''
  try {
    await createPago(
      {
        monto: Number(pagoForm.value.monto) || 0,
        fecha: new Date().toISOString().slice(0, 10), // fecha de hoy (oculta)
        metodo_pago: pagoForm.value.metodo_pago,
        estado: 'pagado', // primer adelanto siempre pagado (oculto)
        observaciones: pagoForm.value.observaciones,
        entidad_id: proyecto.value.id,
        entidad_tipo: 'proyecto',
      },
      comprobante.value,
    )
    showPagoForm.value = false
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar pago'
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const proy = await getProyecto(id)
    const [cli, pag] = await Promise.all([
      getCliente(proy.cliente_id),
      listPagosPorEntidad(id, 'proyecto'),
    ])
    proyecto.value = proy
    cliente.value = cli
    pagos.value = pag
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el proyecto'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main>
    <Breadcrumbs :items="crumbs" />

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else-if="proyecto">
      <div class="head">
        <h1>{{ proyecto.proyecto }}</h1>
        <button class="primary" @click="startEdit">
          <IconEdit :size="18" /> Editar
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Valores del proyecto -->
      <section class="card">
        <dl class="fields">
          <div><dt>Total</dt><dd class="total">S/ {{ Number(proyecto.total || 0).toFixed(2) }}</dd></div>
          <div><dt>Adelanto</dt><dd>S/ {{ Number(proyecto.adelanto || 0).toFixed(2) }}</dd></div>
          <div><dt>Progreso</dt><dd>{{ Number(proyecto.progreso) || 0 }}%</dd></div>
          <div><dt>Estado</dt><dd>{{ capitalize(proyecto.estado) }}</dd></div>
          <div><dt>Fecha inicio</dt><dd>{{ formatDate(proyecto.fecha_inicio) }}</dd></div>
          <div><dt>Fecha final</dt><dd>{{ formatDate(proyecto.fecha_final) }}</dd></div>
          <div><dt>Descripción</dt><dd>{{ proyecto.descripcion || '—' }}</dd></div>
          <div><dt>Observaciones</dt><dd>{{ proyecto.observaciones || '—' }}</dd></div>
        </dl>
      </section>

      <Modal v-if="editing" title="Editar proyecto" @close="editing = false">
        <form class="form" @submit.prevent="saveEdit">
          <div class="grid">
            <label class="full">
              Proyecto *
              <input v-model="editForm.proyecto" type="text" required />
            </label>
            <label class="full">
              Descripción
              <textarea v-model="editForm.descripcion" rows="3"></textarea>
            </label>
            <label>
              Total (S/)
              <input v-model="editForm.total" type="number" min="0" step="0.01" />
            </label>
            <label>
              Adelanto (S/)
              <input v-model="editForm.adelanto" type="number" min="0" step="0.01" />
            </label>
            <label>
              Progreso (%)
              <input v-model="editForm.progreso" type="number" min="0" max="100" step="1" />
            </label>
            <label>
              Estado
              <select v-model="editForm.estado">
                <option value="activo">Activo</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </label>
            <label>
              Fecha inicio
              <input v-model="editForm.fecha_inicio" type="date" />
            </label>
            <label>
              Fecha final
              <input v-model="editForm.fecha_final" type="date" />
            </label>
            <label class="full">
              Observaciones
              <textarea v-model="editForm.observaciones" rows="2"></textarea>
            </label>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <div class="row">
            <button type="submit" class="primary" :disabled="saving">
              <IconLoader v-if="saving" :size="18" class="spin" />
              <IconCheck v-else :size="18" />
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
            <button type="button" class="ghost" @click="editing = false">
              <IconX :size="18" /> Cancelar
            </button>
            <button type="button" class="danger" :disabled="saving" @click="eliminarProyecto">
              <IconTrash :size="18" /> Eliminar
            </button>
          </div>
        </form>
      </Modal>

      <!-- Pagos -->
      <section class="card">
        <div class="tab-head">
          <h2><IconWallet :size="18" /> Pagos</h2>
          <div class="tab-actions">
            <button
              v-if="pagosPendientes.length > 0"
              class="ghost"
              @click="showPendientes = true"
            >
              <IconClock :size="16" /> Pendientes ({{ pagosPendientes.length }})
            </button>
            <button class="ghost" @click="openDeudaForm">
              <IconPlus :size="16" /> Agregar deuda
            </button>
            <button v-if="pagos.length === 0" class="primary" @click="openPagoForm">
              <IconPlus :size="16" /> Agregar primer adelanto
            </button>
          </div>
        </div>

        <Modal v-if="showDeudaForm" title="Agregar deuda" size="sm" @close="showDeudaForm = false">
          <form class="form" @submit.prevent="guardarDeuda">
            <div class="grid">
              <label>
                Monto (S/) *
                <input v-model="deudaForm.monto" type="number" min="0" step="0.01" required />
              </label>
              <label class="full">
                Observaciones
                <textarea
                  v-model="deudaForm.observaciones"
                  rows="2"
                  placeholder="Ej: aumento de proyecto"
                ></textarea>
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconPlus v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="showDeudaForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <Modal v-if="showPagoForm" title="Primer adelanto" @close="showPagoForm = false">
          <form class="form" @submit.prevent="guardarPago">
            <div class="grid">
              <label>
                Monto (S/) *
                <input v-model="pagoForm.monto" type="number" min="0" step="0.01" required />
              </label>
              <label>
                Método de pago
                <select v-model="pagoForm.metodo_pago">
                  <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ m }}</option>
                </select>
              </label>
              <label class="full">
                Comprobante (PDF o imagen)
                <DropzoneFile @change="onFileChange" />
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
              <button type="button" class="ghost" @click="showPagoForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <p v-if="pagos.length === 0" class="muted">Sin pagos registrados.</p>

        <ul v-else class="list">
          <li v-for="pago in pagos" :key="pago.id">
            <div class="pago-wrap">
              <button class="pago-item" type="button" @click="openPagoDetalle(pago)">
                <strong class="monto">S/ {{ Number(pago.monto || 0).toFixed(2) }}</strong>
                <span v-if="pago.fecha"> · {{ formatDateTime(pago.fecha) }}</span>
                <span
                  v-if="pago.metodo_pago && pago.estado !== 'pendiente'"
                  class="metodo-badge"
                  :style="{ color: metodoInfo(pago.metodo_pago).color, background: metodoInfo(pago.metodo_pago).bg }"
                >
                  <component :is="metodoInfo(pago.metodo_pago).icon" :size="14" />
                  {{ pago.metodo_pago }}
                </span>
                <a
                  v-if="pago.comprobante"
                  class="adjunto"
                  :href="getComprobanteUrl(pago) ?? '#'"
                  target="_blank"
                  rel="noopener"
                  title="Abrir comprobante adjunto"
                  @click.stop
                >
                  <IconPaperclip :size="16" />
                </a>
              </button>
              <p v-if="pago.observaciones" class="pago-obs">{{ pago.observaciones }}</p>
            </div>
            <span
              class="badge"
              :style="{ color: pagoInfo(pago.estado).color, background: pagoInfo(pago.estado).bg }"
            >
              {{ pagoInfo(pago.estado).label }}
            </span>
            <button
              class="edit-pago"
              type="button"
              title="Editar pago"
              @click="openPagoEdit(pago)"
            >
              <IconEdit :size="16" />
            </button>
          </li>
        </ul>

        <!-- Constancia de pago (ticket) -->
        <Modal
          v-if="selectedPago"
          title="Constancia de pago"
          size="sm"
          @close="selectedPago = null"
        >
          <div ref="ticketRef" class="ticket-capture">
            <div class="ticket">
              <div class="ticket-head">
                <img src="/infocat_transparente.png" alt="Infocat" class="ticket-logo" />
                <strong>Gestión de Clientes - Infocat</strong>
                <span>Comprobante de pago</span>
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-row">
                <span>Proyecto</span>
                <strong>{{ proyecto?.proyecto || '—' }}</strong>
              </div>
              <div class="ticket-row">
                <span>Cliente</span>
                <strong>{{ cliente?.nombre || '—' }}</strong>
              </div>
              <div class="ticket-row">
                <span>Total del proyecto</span>
                <strong>S/ {{ Number(proyecto?.total || 0).toFixed(2) }}</strong>
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-monto">
                S/ {{ Number(selectedPago.monto || 0).toFixed(2) }}
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-row">
                <span>Fecha</span>
                <strong>{{ formatDateTime(selectedPago.fecha) }}</strong>
              </div>
              <div class="ticket-row">
                <span>Método de pago</span>
                <span
                  class="metodo-badge"
                  :style="{ color: metodoInfo(selectedPago.metodo_pago).color, background: metodoInfo(selectedPago.metodo_pago).bg }"
                >
                  <component :is="metodoInfo(selectedPago.metodo_pago).icon" :size="14" />
                  {{ selectedPago.metodo_pago }}
                </span>
              </div>
              <div class="ticket-row">
                <span>Estado</span>
                <span
                  class="badge"
                  :style="{ color: pagoInfo(selectedPago.estado).color, background: pagoInfo(selectedPago.estado).bg }"
                >
                  {{ pagoInfo(selectedPago.estado).label }}
                </span>
              </div>
              <div v-if="selectedPago.observaciones" class="ticket-row">
                <span>Observaciones</span>
                <strong class="pre">{{ selectedPago.observaciones }}</strong>
              </div>

              <div v-if="comprobanteUrl" class="ticket-sep"></div>

              <div v-if="comprobanteUrl" class="ticket-adjunto">
                <span>Adjunto</span>
                <a v-if="esImagen(selectedPago.comprobante)" :href="comprobanteUrl" target="_blank" rel="noopener">
                  <img :src="comprobanteUrl" alt="Comprobante" class="thumb" />
                </a>
                <a v-else :href="comprobanteUrl" target="_blank" rel="noopener">
                  <IconPaperclip :size="16" /> Ver comprobante
                </a>
              </div>
            </div>
          </div>

          <div class="ticket-actions">
            <button class="primary" :disabled="capturando" @click="capturarTicket">
              <IconLoader v-if="capturando" :size="18" class="spin" />
              <IconCamera v-else :size="18" />
              {{ capturando ? 'Capturando…' : 'Capturar ticket' }}
            </button>
          </div>
        </Modal>

        <!-- Editar pago -->
        <Modal
          v-if="editingPago"
          title="Editar pago"
          size="sm"
          @close="editingPago = null"
        >
          <form class="form" @submit.prevent="savePagoEdit">
            <div class="grid">
              <label>
                Monto (S/) *
                <input v-model="pagoEditForm.monto" type="number" min="0" step="0.01" required />
              </label>
              <label>
                Fecha
                <input v-model="pagoEditForm.fecha" type="date" />
              </label>
              <label>
                Estado
                <select v-model="pagoEditForm.estado">
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="anulado">Anulado</option>
                </select>
              </label>
              <label>
                Método de pago
                <select v-model="pagoEditForm.metodo_pago">
                  <option v-for="m in METODOS_PAGO" :key="m" :value="m">{{ m }}</option>
                </select>
              </label>
              <label class="full">
                Comprobante (PDF o imagen)
                <DropzoneFile @change="onEditFileChange" />
              </label>
              <label class="full">
                Observaciones
                <textarea v-model="pagoEditForm.observaciones" rows="2"></textarea>
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCheck v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="editingPago = null">Cancelar</button>
              <button type="button" class="danger" :disabled="saving" @click="eliminarPago">
                <IconTrash :size="18" /> Eliminar
              </button>
            </div>
          </form>
        </Modal>
      </section>
    </template>
  </main>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: var(--color-background-soft);
  margin-top: 1rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.head h1 {
  margin: 0;
}

.card h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
  margin: 0;
}

.tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab-actions {
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

button.danger {
  background: transparent;
  border: 1px solid rgba(229, 72, 77, 0.4);
  color: #e5484d;
}

button.danger:hover {
  background: rgba(229, 72, 77, 0.1);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin: 0;
}

.fields dt {
  font-size: 0.8rem;
  color: var(--color-text-2);
}

.fields dd {
  margin: 0.15rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.fields .total {
  font-size: 1.4rem;
  font-weight: 700;
  color: hsla(160, 100%, 30%, 1);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
}

.pago-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  padding: 0.25rem 0;
  border: 0;
  background: none;
  color: var(--color-text);
  font-size: 0.95rem;
  text-align: left;
  cursor: pointer;
  border-radius: 0.25rem;
}

.pago-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pago-obs {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-2);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pago-item:hover {
  color: hsla(160, 100%, 30%, 1);
}

.pago-item .monto {
  font-weight: 700;
}

.metodo-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.adjunto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: var(--color-text-2);
  flex-shrink: 0;
  text-decoration: none;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.adjunto:hover {
  color: hsla(160, 100%, 30%, 1);
  background: hsla(160, 100%, 37%, 0.12);
}

.edit-pago {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  border: 0;
  border-radius: 0.35rem;
  background: hsla(160, 100%, 37%, 0.15);
  color: hsla(160, 100%, 30%, 1);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.edit-pago:hover {
  background: hsla(160, 100%, 37%, 0.3);
  color: hsla(160, 100%, 25%, 1);
}

.pago-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
}

.pago-detail dt {
  font-size: 0.8rem;
  color: var(--color-text-2);
}

.pago-detail dd {
  margin: 0.15rem 0 0;
}

.pago-detail .monto {
  font-size: 1.3rem;
  font-weight: 700;
}

/* Ticket / constancia de pago */
.ticket-capture {
  border: 2px dashed var(--color-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: #ffffff;
}

.ticket {
  font-size: 0.9rem;
  color: var(--color-text);
}

.ticket-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  text-align: center;
}

.ticket-logo {
  height: 70px;
  width: auto;
  margin-bottom: 0.25rem;
}

.ticket-head strong {
  font-weight: 800;
  font-size: 1rem;
}

.ticket-head span {
  font-size: 0.8rem;
  color: var(--color-text-2);
}

.ticket-sep {
  border-top: 1px dashed var(--color-border);
  margin: 0.9rem 0;
}

.ticket-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.2rem 0;
}

.ticket-row > span:first-child {
  color: var(--color-text-2);
  font-size: 0.8rem;
  font-weight: 700;
}

.ticket-row strong {
  font-weight: 500;
}

.ticket-row .pre {
  white-space: pre-wrap;
  text-align: right;
  margin: 0;
  font-weight: 400;
}

.ticket-monto {
  text-align: center;
  font-size: 1.8rem;
  font-weight: 800;
  color: hsla(160, 100%, 30%, 1);
}

.ticket-adjunto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.ticket-adjunto > span {
  color: var(--color-text-2);
  font-size: 0.8rem;
  font-weight: 700;
}

.ticket-adjunto a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: hsla(160, 100%, 30%, 1);
  text-decoration: none;
  font-size: 0.85rem;
}

.ticket-adjunto .thumb {
  max-width: 100%;
  max-height: 180px;
  border-radius: 0.35rem;
  border: 1px solid var(--color-border);
  object-fit: contain;
}

.ticket-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.list .pre {
  white-space: pre-wrap;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
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