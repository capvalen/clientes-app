<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import {
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconCamera,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCoin,
  IconDeviceIpadHorizontalUp,
  IconDeviceMobile,
  IconDeviceDesktop,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconHammer,
  IconLoader,
  IconNotes,
  IconPaperclip,
  IconPhone,
  IconPlus,
  IconTrash,
  IconUser,
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
  getComprobanteFiles,
  getToken,
  type Proyecto,
  type Pago,
  type Cliente,
} from '../api/pocketbase'
import { capitalize, formatDate, formatDateTime, formatFechaHora, pbDateTime, upperFirst } from '../utils/format'
import { showMontos, toggleMontos } from '../utils/montos'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import Modal from '../components/Modal.vue'
import DropzoneFile from '../components/DropzoneFile.vue'
import MetodoPagoPicker from '../components/MetodoPagoPicker.vue'

const router = useRouter()
const route = useRoute()
const id = route.params.id as string

const proyecto = ref<Proyecto | null>(null)
const cliente = ref<Cliente | null>(null)
const pagos = ref<Pago[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const crumbs = computed(() => {
  const clienteTo = cliente.value ? `/cliente/${cliente.value.id}?tab=proyectos` : undefined
  return [
    { label: 'Clientes', to: '/cliente' },
    { label: cliente.value?.nombre ?? '…', to: clienteTo },
    { label: 'Proyectos', to: clienteTo },
    { label: proyecto.value?.proyecto ?? '…' },
  ]
})

// Edición de campos primarios
const editing = ref(false)
const editForm = ref({
  proyecto: '',
  descripcion: '',
  total: '',
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
  Interbank: { color: '#00a650', bg: '#e3fbe9', icon: IconBuildingBank },
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

// ---- Estado del proyecto (selector desplegable) ----
const ESTADO_PROYECTO: Record<string, { label: string; color: string; bg: string }> = {
  activo: { label: 'Activo', color: '#1a7f37', bg: '#dafbe1' },
  completado: { label: 'Completado', color: '#0969da', bg: '#ddf4ff' },
  cancelado: { label: 'Cancelado', color: '#e5484d', bg: '#ffebe9' },
}

function proyectoEstadoInfo(estado: string) {
  return (
    ESTADO_PROYECTO[estado] ?? {
      label: capitalize(estado),
      color: '#6e7781',
      bg: '#eaeef2',
    }
  )
}

const estadoRef = ref<HTMLElement | null>(null)
const estadoMenuOpen = ref(false)
const cambiandoEstado = ref(false)

function toggleEstadoMenu() {
  if (cambiandoEstado.value) return
  estadoMenuOpen.value = !estadoMenuOpen.value
}

async function cambiarEstado(estado: Proyecto['estado']) {
  estadoMenuOpen.value = false
  if (!proyecto.value || proyecto.value.estado === estado) return
  cambiandoEstado.value = true
  error.value = ''
  try {
    proyecto.value = await updateProyecto(proyecto.value.id, { estado })
    editForm.value.estado = estado
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar el estado'
  } finally {
    cambiandoEstado.value = false
  }
}

function onDocClick(e: MouseEvent) {
  if (estadoMenuOpen.value && estadoRef.value && !estadoRef.value.contains(e.target as Node)) {
    estadoMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

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
const comprobante = ref<File[]>([])

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
      adelanto: 0, // aún no se abona nada de la deuda
      que_es: 'deuda',
      fecha: pbDateTime(), // fecha y hora actual (formato PocketBase)
      estado: 'pendiente',
      metodo_pago: 'Efectivo',
      observaciones: upperFirst(deudaForm.value.observaciones),
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
const ticketRef = ref<HTMLElement | null>(null)
const capturando = ref(false)

/** Comprobantes adjuntos del pago seleccionado (nombre + URL) */
const comprobanteFiles = computed(() =>
  selectedPago.value ? getComprobanteFiles(selectedPago.value) : [],
)

// Filtro: mostrar solo deudas pendientes
type FiltroPagos = 'todos' | 'deudas'
const filtroPagos = ref<FiltroPagos>('todos')

function toggleFiltroDeudas() {
  filtroPagos.value = filtroPagos.value === 'deudas' ? 'todos' : 'deudas'
}

const pagosPendientes = computed(() =>
  pagos.value.filter((p) => p.estado === 'pendiente'),
)

/** Lista mostrada según el filtro activo (solo deudas o todos) */
const pagosFiltrados = computed(() =>
  filtroPagos.value === 'deudas' ? pagosPendientes.value : pagos.value,
)

/** Monto efectivamente abonado/pagado de un registro */
function pagoAbonado(p: Pago): number {
  if (p.estado === 'anulado') return 0
  const adelanto = Number(p.adelanto) || 0
  if (adelanto > 0) return adelanto
  // Registros antiguos sin 'adelanto': si está pagado se asume el monto completo
  return p.estado === 'pagado' ? Number(p.monto) || 0 : 0
}

/** Total adelantado: suma de los abonos de todos los registros de pago */
const totalAdelanto = computed(() =>
  pagos.value.reduce((sum, p) => sum + pagoAbonado(p), 0),
)

/** Saldo pendiente: total del proyecto menos lo efectivamente adelantado */
const restante = computed(() => {
  const total = Number(proyecto.value?.total) || 0
  return Math.max(0, total - totalAdelanto.value)
})

// Edición de pago (solo método de pago, comprobante y observaciones)
const editingPago = ref<Pago | null>(null)
const pagoEditForm = ref({
  monto: '',
  metodo_pago: 'Efectivo',
  observaciones: '',
})
const nuevoComprobante = ref<File[]>([])

/** Comprobantes ya guardados del pago en edición (solo lectura) */
const existingComprobantes = computed(() =>
  editingPago.value ? getComprobanteFiles(editingPago.value) : [],
)

// Realizar pago: abonar a una deuda hasta completarla
const realizarPagoTarget = ref<Pago | null>(null)
const realizarPagoMonto = ref('')
const realizarPagoMetodo = ref('Efectivo')

/** Saldo de la deuda seleccionada (monto - adelanto) */
const saldoDeuda = computed(() => {
  const p = realizarPagoTarget.value
  if (!p) return 0
  return Math.max(0, (Number(p.monto) || 0) - (Number(p.adelanto) || 0))
})

function openRealizarPago(pago: Pago) {
  realizarPagoTarget.value = pago
  const saldo = Math.max(0, (Number(pago.monto) || 0) - (Number(pago.adelanto) || 0))
  realizarPagoMonto.value = String(saldo)
  realizarPagoMetodo.value = pago.metodo_pago || 'Efectivo'
}

function closeRealizarPago() {
  realizarPagoTarget.value = null
  realizarPagoMonto.value = ''
  realizarPagoMetodo.value = 'Efectivo'
}

async function guardarRealizarPago() {
  const pago = realizarPagoTarget.value
  if (!pago) return
  const abono = Number(realizarPagoMonto.value) || 0
  if (abono <= 0) return
  saving.value = true
  error.value = ''
  try {
    const total = Number(pago.monto) || 0
    const nuevoAdelanto = Math.min(total, (Number(pago.adelanto) || 0) + abono)
    // Si el adelanto cubre el monto, el registro entero pasa a 'pago' pagado
    const completo = nuevoAdelanto >= total
    const data: Partial<Pago> = {
      adelanto: nuevoAdelanto,
      metodo_pago: realizarPagoMetodo.value,
    }
    if (completo) {
      data.estado = 'pagado'
      data.que_es = 'pago'
    }
    await updatePago(pago.id, data)
    closeRealizarPago()
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al registrar el pago'
  } finally {
    saving.value = false
  }
}

function openPagoEdit(pago: Pago) {
  pagoEditForm.value = {
    monto: String(pago.monto ?? ''),
    metodo_pago: pago.metodo_pago || 'Efectivo',
    observaciones: pago.observaciones ?? '',
  }
  nuevoComprobante.value = []
  editingPago.value = pago
}

async function savePagoEdit() {
  if (!editingPago.value) return
  const esDeuda = editingPago.value.que_es === 'deuda'
  const montoAnterior = Number(editingPago.value.monto) || 0
  const montoNuevo = Number(pagoEditForm.value.monto) || 0
  saving.value = true
  error.value = ''
  try {
    const data: Partial<Pago> = {
      metodo_pago: pagoEditForm.value.metodo_pago,
      observaciones: pagoEditForm.value.observaciones,
    }

    // Solo las deudas permiten modificar el monto
    if (esDeuda) {
      data.monto = montoNuevo
      // Si el abono supera el nuevo monto, se ajusta y el registro pasa a pago
      const adelanto = Number(editingPago.value.adelanto) || 0
      if (montoNuevo > 0 && adelanto >= montoNuevo) {
        data.adelanto = montoNuevo
        data.estado = 'pagado'
        data.que_es = 'pago'
      }
    }

    await updatePago(editingPago.value.id, data, nuevoComprobante.value, {
      // Los nuevos comprobantes se AÑADEN a los que ya tiene el registro
      appendComprobantes: true,
    })

    // Ajustar el total del proyecto por la diferencia de la deuda
    if (esDeuda && proyecto.value && montoNuevo !== montoAnterior) {
      proyecto.value = await updateProyecto(proyecto.value.id, {
        total: Math.max(0, (Number(proyecto.value.total) || 0) + (montoNuevo - montoAnterior)),
      })
    }

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
    const montoEliminado = Number(editingPago.value.monto) || 0

    await deletePago(editingPago.value.id)

    // Restar el monto eliminado al total del proyecto
    if (proyecto.value && montoEliminado > 0) {
      proyecto.value = await updateProyecto(proyecto.value.id, {
        total: Math.max(0, (Number(proyecto.value.total) || 0) - montoEliminado),
      })
    }

    editingPago.value = null
    pagos.value = await listPagosPorEntidad(id, 'proyecto')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar pago'
  } finally {
    saving.value = false
  }
}

function onEditFileChange(files: File[]) {
  nuevoComprobante.value = files
}

function openPagoDetalle(pago: Pago) {
  selectedPago.value = pago
}

async function capturarTicket() {
  const el = ticketRef.value
  if (!el || !selectedPago.value) return
  capturando.value = true
  try {
    // Convertir las miniaturas a dataURL para evitar el bloqueo cross-origin del canvas
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img.thumb'))
    const originals: { img: HTMLImageElement; src: string }[] = []
    const headers: Record<string, string> = {}
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    for (const img of imgs) {
      if (!img.src) continue
      originals.push({ img, src: img.src })
      try {
        const res = await fetch(img.src, { headers })
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
          reader.readAsDataURL(blob)
        })
        img.src = dataUrl
      } catch {
        // si falla, se captura sin la imagen
      }
    }
    if (originals.length) await new Promise((r) => setTimeout(r, 100))

    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })

    // Crear canvas con padding: +30px en X, +20px en Y, contenido desplazado 15px derecha y 10px abajo
    const offsetX = 15 * 2  // scale factor
    const offsetY = 10 * 2
    const newWidth = canvas.width + 30 * 2
    const newHeight = canvas.height + 20 * 2
    const resultCanvas = document.createElement('canvas')
    resultCanvas.width = newWidth
    resultCanvas.height = newHeight
    const ctx = resultCanvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, newWidth, newHeight)
    ctx.drawImage(canvas, offsetX, offsetY)

    originals.forEach(({ img, src }) => {
      img.src = src
    })

    const link = document.createElement('a')
    link.download = `pago-${selectedPago.value.id}.png`
    link.href = resultCanvas.toDataURL('image/png')
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
  comprobante.value = []
  showPagoForm.value = true
}

function onFileChange(files: File[]) {
  comprobante.value = files
}

async function guardarPago() {
  if (!proyecto.value || !pagoForm.value.monto) return
  saving.value = true
  error.value = ''
  try {
    await createPago(
      {
        monto: Number(pagoForm.value.monto) || 0,
        adelanto: Number(pagoForm.value.monto) || 0, // pago completo
        que_es: 'pago',
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
        <div class="head-title">
          <h1>{{ proyecto.proyecto }}</h1>
          <span class="tipo-badge">
            <IconHammer :size="14" class="flip-y" />
            Proyecto
          </span>
        </div>
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
          <button class="primary" @click="startEdit">
            <IconEdit :size="18" /> Editar
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Valores del proyecto -->
      <section class="card">
        <dl class="fields">
          <div><dt>Total</dt><dd class="total"><Monto :value="proyecto.total" /></dd></div>
          <div><dt>Adelanto</dt><dd><Monto :value="totalAdelanto" /></dd></div>
          <div><dt>Restante</dt><dd class="restante"><Monto :value="restante" /></dd></div>
          <div><dt>Progreso</dt><dd>{{ Number(proyecto.progreso) || 0 }}%</dd></div>
          <div>
            <dt>Estado</dt>
            <dd class="estado-dd">
              <div ref="estadoRef" class="estado-wrap">
                <button
                  type="button"
                  class="estado-btn"
                  :style="{
                    color: proyectoEstadoInfo(proyecto.estado).color,
                    background: proyectoEstadoInfo(proyecto.estado).bg,
                  }"
                  :disabled="cambiandoEstado"
                  title="Cambiar estado"
                  aria-haspopup="listbox"
                  :aria-expanded="estadoMenuOpen"
                  @click="toggleEstadoMenu"
                >
                  <IconLoader v-if="cambiandoEstado" :size="13" class="spin" />
                  {{ proyectoEstadoInfo(proyecto.estado).label }}
                  <IconChevronDown
                    :size="14"
                    class="caret"
                    :class="{ open: estadoMenuOpen }"
                  />
                </button>

                <ul v-if="estadoMenuOpen" class="estado-menu" role="listbox">
                  <li v-for="(info, key) in ESTADO_PROYECTO" :key="key">
                    <button
                      type="button"
                      class="estado-item"
                      :class="{ active: proyecto.estado === key }"
                      role="option"
                      :aria-selected="proyecto.estado === key"
                      @click="cambiarEstado(key as Proyecto['estado'])"
                    >
                      <span class="dot" :style="{ background: info.color }"></span>
                      {{ info.label }}
                      <IconCheck v-if="proyecto.estado === key" :size="14" class="check" />
                    </button>
                  </li>
                </ul>
              </div>
            </dd>
          </div>
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
              v-if="pagos.length > 0"
              class="ghost"
              :class="{ active: filtroPagos === 'deudas' }"
              :title="filtroPagos === 'deudas' ? 'Ver todos los registros' : 'Ver solo deudas pendientes'"
              @click="toggleFiltroDeudas"
            >
              <IconFilter :size="16" />
              {{
                filtroPagos === 'deudas'
                  ? `Solo deudas (${pagosPendientes.length})`
                  : `Pagos (${pagos.length})`
              }}
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
              <label class="full">
                Detalle
                <textarea
                  v-model="deudaForm.observaciones"
                  rows="2"
                  placeholder="Ej: Aumento de proyecto"
                ></textarea>
              </label>
              <label>
                Monto (S/) *
                <input v-model="deudaForm.monto" type="number" min="0" step="0.01" required />
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
                <MetodoPagoPicker v-model="pagoForm.metodo_pago" />
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
        <p v-else-if="pagosFiltrados.length === 0" class="muted">
          <IconClock :size="16" /> Sin deudas pendientes.
        </p>

        <ul v-else class="list">
          <li v-for="pago in pagosFiltrados" :key="pago.id">
            <div class="pago-wrap">
              <button class="pago-item" type="button" @click="openPagoDetalle(pago)">
                <strong class="monto"><Monto :value="pago.monto" /></strong>
                <span class="pago-sep">·</span>
                <span class="pago-desc">{{ pago.observaciones || '' }}</span>
                <span v-if="pago.que_es === 'deuda'" class="que-es-badge">Deuda</span>
                <span
                  v-if="pago.metodo_pago && pago.estado !== 'pendiente'"
                  class="metodo-badge"
                  :style="{ color: metodoInfo(pago.metodo_pago).color, background: metodoInfo(pago.metodo_pago).bg }"
                >
                  <component :is="metodoInfo(pago.metodo_pago).icon" :size="14" />
                  {{ pago.metodo_pago }}
                </span>
                <a
                  v-for="file in getComprobanteFiles(pago)"
                  :key="file.name"
                  class="adjunto"
                  :href="file.url"
                  target="_blank"
                  rel="noopener"
                  :title="`Abrir ${file.name}`"
                  @click.stop
                >
                  <IconPaperclip :size="16" />
                </a>
              </button>
              <span class="pago-fecha">
                <IconCalendar :size="13" />
                {{ formatFechaHora(pago.fecha) }}
              </span>
              <span v-if="pago.que_es === 'deuda'" class="pago-adelanto">
                Adelanto: <Monto :value="pago.adelanto" />
              </span>
            </div>
            <span
              class="badge"
              :style="{ color: pagoInfo(pago.estado).color, background: pagoInfo(pago.estado).bg }"
            >
              {{ pagoInfo(pago.estado).label }}
            </span>
            <button
              v-if="pago.estado === 'pendiente'"
              class="realizar-pago"
              type="button"
              title="Realizar pago"
              @click="openRealizarPago(pago)"
            >
              <IconDeviceIpadHorizontalUp :size="16" /> Realizar pago
            </button>
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

        <!-- Realizar pago (abonar a una deuda) -->
        <Modal
          v-if="realizarPagoTarget"
          title="Realizar pago"
          size="sm"
          @close="closeRealizarPago"
        >
          <form class="form" @submit.prevent="guardarRealizarPago">
            <dl class="fields resumen">
              <div v-if="realizarPagoTarget.observaciones" class="full">
                <dt>Descripción</dt>
                <dd>{{ realizarPagoTarget.observaciones }}</dd>
              </div>
              <div><dt>Total</dt><dd><Monto :value="realizarPagoTarget.monto" /></dd></div>
              <div><dt>Abonado</dt><dd class="abonado"><Monto :value="realizarPagoTarget.adelanto" /></dd></div>
              <div><dt>Pendiente</dt><dd class="restante"><Monto :value="saldoDeuda" /></dd></div>
            </dl>
            <div class="grid">
              <label class="full">
                Método de pago
                <MetodoPagoPicker v-model="realizarPagoMetodo" />
              </label>
              <label class="full">
                Monto a pagar (S/) *
                <input
                  v-model="realizarPagoMonto"
                  type="number"
                  min="0"
                  :max="saldoDeuda"
                  step="0.01"
                  required
                />
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCash v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Registrar pago' }}
              </button>
              <button type="button" class="ghost" @click="closeRealizarPago">Cancelar</button>
            </div>
          </form>
        </Modal>

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
                <strong>{{ selectedPago.que_es === 'deuda' ? 'Registro de Deuda' : 'Constancia de pago' }}</strong>
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-row">
                <span><IconDeviceDesktop :size="14" /> Proyecto</span>
                <strong>{{ proyecto?.proyecto || '—' }}</strong>
              </div>
              <div class="ticket-row">
                <span><IconUser :size="14" /> Cliente</span>
                <strong>{{ cliente?.nombre || '—' }}</strong>
              </div>
              <div v-if="selectedPago.observaciones" class="ticket-row">
                <span><IconNotes :size="14" /> Detalle</span>
                <strong class="pre">{{ selectedPago.observaciones }}</strong>
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-estado-label" :class="{ deuda: selectedPago.que_es === 'deuda' }">
                {{ selectedPago.que_es === 'deuda' ? 'Adeuda' : 'Pagado' }}
              </div>
              <div class="ticket-monto" :class="{ deuda: selectedPago.que_es === 'deuda' }">
                <span class="ticket-moneda">S/</span> {{ Number(selectedPago.monto || 0).toFixed(2) }}
              </div>

              <div class="ticket-sep"></div>

              <div class="ticket-row">
                <span><IconCalendar :size="14" /> Fecha</span>
                <strong>{{ formatDateTime(selectedPago.fecha) }}</strong>
              </div>
              <div class="ticket-row">
                <span><IconWallet :size="14" /> Método de pago</span>
                <span
                  class="metodo-badge"
                  :style="{ color: metodoInfo(selectedPago.metodo_pago).color, background: metodoInfo(selectedPago.metodo_pago).bg }"
                >
                  <component :is="metodoInfo(selectedPago.metodo_pago).icon" :size="14" />
                  {{ selectedPago.metodo_pago }}
                </span>
              </div>
              <div class="ticket-row">
                <span><IconCheck :size="14" /> Estado</span>
                <span
                  class="badge"
                  :style="{ color: pagoInfo(selectedPago.estado).color, background: pagoInfo(selectedPago.estado).bg }"
                >
                  {{ pagoInfo(selectedPago.estado).label }}
                </span>
              </div>

              <div v-if="comprobanteFiles.length" class="ticket-sep"></div>

              <div v-if="comprobanteFiles.length" class="ticket-adjunto">
                <span><IconPaperclip :size="14" /> Adjuntos</span>
                <template v-for="file in comprobanteFiles" :key="file.name">
                  <a v-if="esImagen(file.name)" :href="file.url" target="_blank" rel="noopener">
                    <img :src="file.url" alt="Comprobante" class="thumb" />
                  </a>
                  <a v-else :href="file.url" target="_blank" rel="noopener">
                    <IconPaperclip :size="16" /> {{ file.name }}
                  </a>
                </template>
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
              <label v-if="editingPago.que_es === 'deuda'">
                Monto (S/) *
                <input v-model="pagoEditForm.monto" type="number" min="0" step="0.01" required />
              </label>
              <label class="full">
                Método de pago
                <MetodoPagoPicker v-model="pagoEditForm.metodo_pago" />
              </label>
              <label class="full">
                Comprobante (PDF o imagen)
                <DropzoneFile :existing="existingComprobantes" @change="onEditFileChange" />
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

.head-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.head h1 {
  margin: 0;
}

.tipo-badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #6e7781;
  background: #eaeef2;
  border: 1px solid var(--color-border);
}

.flip-y {
  transform: scaleX(-1);
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
  color: var(--color-primary-dark);
}

.fields .restante {
  font-size: 1.4rem;
  font-weight: 700;
  color: #e5484d;
}

/* Selector de estado (desplegable) */
.estado-wrap {
  position: relative;
  display: inline-block;
}

.estado-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.estado-btn:hover {
  filter: brightness(0.96);
}

.estado-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.estado-btn .caret {
  transition: transform 0.15s ease;
}

.estado-btn .caret.open {
  transform: rotate(180deg);
}

.estado-menu {
  position: absolute;
  top: calc(100% + 0.3rem);
  left: 0;
  z-index: 20;
  min-width: 160px;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
  /* El dd padre usa white-space: pre-wrap (heredado); se neutraliza aquí */
  white-space: normal;
  text-align: left;
}

.estado-menu li {
  margin: 0;
  padding: 0;
  list-style: none;
}

.estado-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}

.estado-item:hover {
  background: var(--color-background-mute);
}

.estado-item.active {
  font-weight: 600;
}

.estado-item .dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex-shrink: 0;
}

.estado-item .check {
  margin-left: auto;
  flex-shrink: 0;
}

.fields .full {
  grid-column: 1 / -1;
}

/* Resumen a todo el ancho: etiqueta a un extremo, valor al otro extremo */
.fields.resumen {
  grid-template-columns: 1fr;
  gap: 0.4rem;
}

.fields.resumen > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.fields.resumen dt {
  font-size: 0.82rem;
  color: var(--color-text-2);
}

.fields.resumen dd {
  margin: 0;
  text-align: right;
}

.fields.resumen .abonado {
  color: #0969da;
}

.fields.resumen .full {
  display: block;
}

.fields.resumen .full dd {
  text-align: left;
}

.fields.resumen .restante {
  font-size: inherit;
  font-weight: inherit;
  color: #e5484d;
}

.tab-actions button.active {
  border-color: hsl(var(--primary) / 0.6);
  background: hsl(var(--primary) / 0.15);
  color: var(--color-primary-dark);
  font-weight: 600;
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
  gap: 0.75rem;
  flex-wrap: wrap;
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
  min-width: 0;
}

.pago-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pago-sep {
  color: var(--color-text-2);
}

.pago-desc {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pago-fecha {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.2rem;
  font-size: 0.78rem;
  font-style: italic;
  color: var(--color-text-2);
}

.pago-adelanto {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: #0969da;
}

.que-es-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #6e7781;
  background: #eaeef2;
  flex-shrink: 0;
}

.realizar-pago {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid hsl(var(--primary) / 0.5);
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-primary-dark);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.realizar-pago:hover {
  background: hsl(var(--primary) / 0.12);
}

.pago-item:hover {
  color: var(--color-primary-dark);
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
  color: var(--color-primary-dark);
  background: hsl(var(--primary) / 0.12);
}

.edit-pago {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  border: 0;
  border-radius: 0.35rem;
  background: hsl(var(--primary) / 0.15);
  color: var(--color-primary-dark);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.edit-pago:hover {
  background: hsl(var(--primary) / 0.3);
  color: var(--color-primary-darker);
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
  margin: 1.25rem;
  background: #ffffff;
}

.ticket {
  font-size: 0.9rem;
  color: var(--color-text);
  padding: 20px;
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
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
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
  color: var(--color-primary-dark);
}

.ticket-moneda {
  font-size: 0.7em;
  font-weight: 700;
}

.ticket-estado-label {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6e7781;
}

.ticket-estado-label.deuda {
  color: #ffab00;
}

.ticket-monto.deuda {
  color: #ffab00;
}

.ticket-adjunto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.ticket-adjunto > span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-text-2);
  font-size: 0.8rem;
  font-weight: 700;
}

.ticket-adjunto a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  color: var(--color-primary-dark);
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