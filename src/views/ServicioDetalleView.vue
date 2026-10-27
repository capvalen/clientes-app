<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import {
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconCamera,
  IconCash,
  IconCheck,
  IconCoin,
  IconDeviceIpadHorizontalUp,
  IconDeviceMobile,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLoader,
  IconNotes,
  IconPaperclip,
  IconPhone,
  IconPlus,
  IconShare,
  IconTools,
  IconTrash,
  IconUser,
  IconWallet,
  IconX,
} from '@tabler/icons-vue'
import {
  getServicio,
  getCliente,
  updateServicio,
  deleteServicio,
  listPagosPorEntidad,
  createPago,
  updatePago,
  deletePago,
  getComprobanteFiles,
  getToken,
  type Servicio,
  type Pago,
  type Cliente,
} from '../api/pocketbase'
import { capitalize, formatDate, formatFechaCorta, pbDateTime, upperFirst } from '../utils/format'
import { sumarPeriocidad, PERIOCIDAD_LABEL } from '../utils/cuotas'
import { showMontos, monto, toggleMontos } from '../utils/montos'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import Modal from '../components/Modal.vue'
import DropzoneFile from '../components/DropzoneFile.vue'
import MetodoPagoPicker from '../components/MetodoPagoPicker.vue'

const router = useRouter()
const route = useRoute()
const id = route.params.id as string

const servicio = ref<Servicio | null>(null)
const cliente = ref<Cliente | null>(null)
const pagos = ref<Pago[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const crumbs = computed(() => {
  const clienteTo = cliente.value ? `/cliente/${cliente.value.id}?tab=servicios` : undefined
  return [
    { label: 'Clientes', to: '/cliente' },
    { label: cliente.value?.nombre ?? '…', to: clienteTo },
    { label: 'Servicios', to: clienteTo },
    { label: servicio.value?.servicio ?? '…' },
  ]
})

// Edición de campos primarios
const editing = ref(false)
const editForm = ref({
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

function startEdit() {
  if (!servicio.value) return
  editForm.value = {
    servicio: servicio.value.servicio ?? '',
    descripcion: servicio.value.descripcion ?? '',
    total: String(servicio.value.total ?? ''),
    periocidad: servicio.value.periocidad ?? 'mensual',
    duracion_dias: String(servicio.value.duracion_dias ?? 0),
    estado: servicio.value.estado ?? 'activo',
    // PocketBase devuelve datetime completo; el input date necesita YYYY-MM-DD
    fecha_inicio: (servicio.value.fecha_inicio ?? '').slice(0, 10),
    fecha_final: (servicio.value.fecha_final ?? '').slice(0, 10),
    observaciones: servicio.value.observaciones ?? '',
  }
  editing.value = true
}

async function saveEdit() {
  if (!servicio.value) return
  saving.value = true
  error.value = ''
  try {
    servicio.value = await updateServicio(servicio.value.id, {
      servicio: editForm.value.servicio,
      descripcion: editForm.value.descripcion,
      total: Number(editForm.value.total) || 0,
      periocidad: editForm.value.periocidad as Servicio['periocidad'],
      duracion_dias: Number(editForm.value.duracion_dias) || 0,
      estado: editForm.value.estado as Servicio['estado'],
      fecha_inicio: editForm.value.fecha_inicio ? pbDateTime(editForm.value.fecha_inicio) : '',
      fecha_final: editForm.value.fecha_final ? pbDateTime(editForm.value.fecha_final) : '',
      observaciones: editForm.value.observaciones,
    })
    editing.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function eliminarServicio() {
  if (!servicio.value) return
  if (!confirm(`¿Eliminar el servicio "${servicio.value.servicio}"?`)) return
  saving.value = true
  error.value = ''
  try {
    await deleteServicio(servicio.value.id)
    router.push('/servicio')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar servicio'
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

function esImagen(nombre: string | undefined): boolean {
  if (!nombre) return false
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(nombre)
}

// Primer pago
const showPagoForm = ref(false)
const pagoForm = ref({
  monto: '',
  metodo_pago: 'Efectivo',
  observaciones: '',
})
const comprobante = ref<File[]>([])

// Agregar deuda
const showDeudaForm = ref(false)
const deudaForm = ref({ temporadas: '1', observaciones: '' })

function openDeudaForm() {
  deudaForm.value = { temporadas: '1', observaciones: '' }
  showDeudaForm.value = true
}

async function guardarDeuda() {
  if (!servicio.value) return
  saving.value = true
  error.value = ''
  try {
    const temporadas = Math.max(1, Number(deudaForm.value.temporadas) || 1)
    // El monto de cada pago es IGUAL al total del servicio (no se suma al total)
    const monto = Number(servicio.value.total) || 0

    // Fecha base: la fecha MÁS ALTA de los pagos (o hoy si no hay pagos)
    let fechaBase = new Date().toISOString().slice(0, 10)
    if (pagos.value.length > 0) {
      const ultimo = [...pagos.value].sort((a, b) => (a.fecha > b.fecha ? -1 : 1))[0]
      if (ultimo?.fecha) fechaBase = ultimo.fecha
    }

    // Crear N pagos pendientes saltando según la periocidad
    for (let i = 0; i < temporadas; i++) {
      const fecha = sumarPeriocidad(fechaBase, servicio.value.periocidad)
      await createPago({
        monto,
        adelanto: 0,
        que_es: 'deuda',
        fecha: pbDateTime(fecha), // fecha con hora (formato PocketBase)
        estado: 'pendiente',
        metodo_pago: 'Efectivo',
        observaciones: upperFirst(deudaForm.value.observaciones),
        entidad_id: servicio.value.id,
        entidad_tipo: 'servicio',
      })
      fechaBase = fecha
    }

    showDeudaForm.value = false
    pagos.value = await listPagosPorEntidad(id, 'servicio')
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

// Cronograma de deudas
const showCronograma = ref(false)
const cronogramaServicios = ref<Servicio[]>([])
const cronogramaPagos = ref<Map<string, Pago[]>>(new Map())
const cronogramaClientes = ref<Map<string, Cliente>>(new Map())
const cronogramaTicketRef = ref<HTMLElement | null>(null)
const capturandoCronograma = ref(false)

async function openCronograma() {
  showCronograma.value = true
  cronogramaPagos.value = new Map()
  cronogramaClientes.value = new Map()
  cronogramaServicios.value = []

  if (!servicio.value) return

  const pagos = await listPagosPorEntidad(id, 'servicio')
  const pendientes = pagos.filter((p) => p.estado === 'pendiente')
  if (pendientes.length > 0) {
    cronogramaServicios.value.push(servicio.value)
    cronogramaPagos.value.set(servicio.value.id, pendientes)
    if (cliente.value) {
      cronogramaClientes.value.set(cliente.value.id, cliente.value)
    }
  }
}

function cronogramaClienteNombre(id: string) {
  return cronogramaClientes.value.get(id)?.nombre ?? '—'
}

/** Sumatoria de los montos pendientes de un servicio del cronograma */
function cronogramaTotal(id: string): number {
  const lista = cronogramaPagos.value.get(id) ?? []
  return lista.reduce((acc, p) => acc + (Number(p.monto) || 0), 0)
}

async function capturarCronograma() {
  const el = cronogramaTicketRef.value
  if (!el) return
  capturandoCronograma.value = true
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    })

    // Crear canvas con padding: +30px en X, +20px en Y, contenido desplazado 15px derecha y 10px abajo
    const offsetX = 15 * 2
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

    const link = document.createElement('a')
    link.download = `cronograma-deudas-${new Date().toISOString().slice(0, 10)}.png`
    link.href = resultCanvas.toDataURL('image/png')
    link.click()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al capturar el cronograma'
  } finally {
    capturandoCronograma.value = false
  }
}

// Edición de pago (solo método de pago, comprobante y observaciones)
const editingPago = ref<Pago | null>(null)
const pagoEditForm = ref({
  monto: '',
  fecha: '',
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
    pagos.value = await listPagosPorEntidad(id, 'servicio')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al registrar el pago'
  } finally {
    saving.value = false
  }
}

function openPagoEdit(pago: Pago) {
  pagoEditForm.value = {
    monto: String(pago.monto ?? ''),
    fecha: (pago.fecha ?? '').slice(0, 10),
    metodo_pago: pago.metodo_pago || 'Efectivo',
    observaciones: pago.observaciones ?? '',
  }
  nuevoComprobante.value = []
  editingPago.value = pago
}

async function savePagoEdit() {
  if (!editingPago.value) return
  const esDeuda = editingPago.value.que_es === 'deuda'
  saving.value = true
  error.value = ''
  try {
    const data: Partial<Pago> = {
      fecha: pagoEditForm.value.fecha ? pbDateTime(pagoEditForm.value.fecha) : pagoEditForm.value.fecha,
      metodo_pago: pagoEditForm.value.metodo_pago,
      observaciones: pagoEditForm.value.observaciones,
    }

    // Solo las deudas permiten modificar el monto
    if (esDeuda) {
      const montoNuevo = Number(pagoEditForm.value.monto) || 0
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

    editingPago.value = null
    pagos.value = await listPagosPorEntidad(id, 'servicio')
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
    pagos.value = await listPagosPorEntidad(id, 'servicio')
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
  if (!servicio.value || !pagoForm.value.monto) return
  saving.value = true
  error.value = ''
  try {
    await createPago(
      {
        monto: Number(pagoForm.value.monto) || 0,
        adelanto: Number(pagoForm.value.monto) || 0,
        que_es: 'pago',
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: pagoForm.value.metodo_pago,
        estado: 'pagado',
        observaciones: pagoForm.value.observaciones,
        entidad_id: servicio.value.id,
        entidad_tipo: 'servicio',
      },
      comprobante.value,
    )
    showPagoForm.value = false
    pagos.value = await listPagosPorEntidad(id, 'servicio')
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
    const serv = await getServicio(id)
    const [cli, pag] = await Promise.all([
      getCliente(serv.cliente_id),
      listPagosPorEntidad(id, 'servicio'),
    ])
    servicio.value = serv
    cliente.value = cli
    pagos.value = pag
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el servicio'
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

    <template v-else-if="servicio">
      <div class="head">
        <h1>{{ servicio.servicio }}</h1>
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
          <button class="ghost" @click="openCronograma">
            <IconShare :size="16" /> Compartir cronograma de deudas
          </button>
          <button class="primary" @click="startEdit">
            <IconEdit :size="18" /> Editar
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Valores del servicio -->
      <section class="card">
        <dl class="fields">
          <div><dt>Total</dt><dd class="total">{{ monto(servicio.total) }}</dd></div>
          <div><dt>Periocidad</dt><dd>{{ PERIOCIDAD_LABEL[servicio.periocidad] }}</dd></div>
          <div><dt>Estado</dt><dd>{{ capitalize(servicio.estado) }}</dd></div>
          <div><dt>Fecha inicio</dt><dd>{{ formatDate(servicio.fecha_inicio) }}</dd></div>
          <div><dt>Fecha final</dt><dd>{{ formatDate(servicio.fecha_final) }}</dd></div>
          <div><dt>Descripción</dt><dd>{{ servicio.descripcion || '—' }}</dd></div>
          <div><dt>Observaciones</dt><dd>{{ servicio.observaciones || '—' }}</dd></div>
        </dl>
      </section>

      <Modal v-if="editing" title="Editar servicio" @close="editing = false">
        <form class="form" @submit.prevent="saveEdit">
          <div class="grid">
            <label class="full">
              Servicio *
              <input v-model="editForm.servicio" type="text" required />
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
              Periocidad
              <select v-model="editForm.periocidad">
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="bianual">Bianual</option>
                <option value="anual">Anual</option>
              </select>
            </label>
            <label>
              Duración (días)
              <input v-model="editForm.duracion_dias" type="number" min="0" step="1" />
            </label>
            <label>
              Estado
              <select v-model="editForm.estado">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
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
            <button type="button" class="danger" :disabled="saving" @click="eliminarServicio">
              <IconTrash :size="18" /> Eliminar
            </button>
          </div>
        </form>
      </Modal>

      <!-- Pagos -->
      <section class="card">
        <div class="tab-head">
          <h2><IconWallet :size="18" /> Cuotas</h2>
          <div class="tab-actions">
            <button class="ghost" @click="openDeudaForm">
              <IconPlus :size="16" /> Agregar deuda
            </button>
            <button v-if="pagos.length === 0" class="primary" @click="openPagoForm">
              <IconPlus :size="16" /> Agregar primer pago
            </button>
          </div>
        </div>

        <Modal v-if="showDeudaForm" title="Agregar deuda" size="sm" @close="showDeudaForm = false">
          <form class="form" @submit.prevent="guardarDeuda">
            <div class="grid">
              <label>
                Monto por pago (S/)
                <input :value="monto(servicio?.total)" type="text" disabled />
              </label>
              <label>
                # temporadas
                <input v-model="deudaForm.temporadas" type="number" min="1" step="1" />
              </label>
              <label class="full">
                Observaciones
                <textarea
                  v-model="deudaForm.observaciones"
                  rows="2"
                  placeholder="Ej: aumento de servicio"
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

        <Modal v-if="showPagoForm" title="Primer pago" @close="showPagoForm = false">
          <form class="form" @submit.prevent="guardarPago">
            <div class="grid">
              <label>
                Monto (S/) *
                <input v-model="pagoForm.monto" type="number" min="0" step="0.01" required />
              </label>
              <label class="full">
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

        <ul v-else class="list">
          <li v-for="pago in pagos" :key="pago.id">
            <div class="pago-wrap">
              <button class="pago-item" type="button" @click="openPagoDetalle(pago)">
                <strong class="monto">{{ monto(pago.monto) }}</strong>
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
                {{ formatFechaCorta(pago.fecha) }}
              </span>
              <span v-if="pago.que_es === 'deuda'" class="pago-adelanto">
                Adelanto: {{ monto(pago.adelanto) }}
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
              <div><dt>Total</dt><dd>{{ monto(realizarPagoTarget.monto) }}</dd></div>
              <div><dt>Abonado</dt><dd class="abonado">{{ monto(realizarPagoTarget.adelanto) }}</dd></div>
              <div><dt>Pendiente</dt><dd class="restante">{{ monto(saldoDeuda) }}</dd></div>
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
                <span><IconTools :size="14" /> Servicio</span>
                <strong>{{ servicio?.servicio || '—' }}</strong>
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
                <strong>{{ formatFechaCorta(selectedPago.fecha) }}</strong>
              </div>
              <div v-if="selectedPago.estado !== 'pendiente'" class="ticket-row">
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
                <span>Adjuntos</span>
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
              <label>
                Fecha
                <input v-model="pagoEditForm.fecha" type="date" />
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

        <!-- Cronograma de deudas pendientes -->
        <Modal
          v-if="showCronograma"
          title="Cronograma de deudas pendientes"
          size="sm"
          @close="showCronograma = false"
        >
          <div ref="cronogramaTicketRef" class="ticket-capture">
            <div class="ticket">
              <div class="ticket-head">
                <img src="/infocat_transparente.png" alt="Infocat" class="ticket-logo" />
                <strong>Cronograma de deudas pendientes</strong>
              </div>

              <div class="ticket-sep"></div>

              <p v-if="cronogramaServicios.length === 0" class="muted">
                No hay deudas pendientes de pago.
              </p>

              <div v-for="s in cronogramaServicios" :key="s.id" class="cronograma-servicio">
                <div class="ticket-row">
                  <span>Servicio</span>
                  <strong>{{ s.servicio }}</strong>
                </div>
                <div class="ticket-row">
                  <span>Cliente</span>
                  <strong>{{ cronogramaClienteNombre(s.cliente_id) }}</strong>
                </div>

                <p class="cronograma-titulo">Cronograma de fechas</p>

                <div class="cronograma-encabezado">
                  <strong>Fecha</strong>
                  <strong>Monto</strong>
                </div>

                <div class="cronograma-pagos">
                  <div v-for="p in cronogramaPagos.get(s.id)" :key="p.id" class="cronograma-pago">
                    <span class="cronograma-fecha">{{ formatFechaCorta(p.fecha) }}</span>
                    <span class="cronograma-monto">{{ monto(p.monto) }}</span>
                  </div>
                </div>

                <div class="cronograma-total">
                  <strong>Total</strong>
                  <strong>{{ monto(cronogramaTotal(s.id)) }}</strong>
                </div>

                <div class="ticket-sep"></div>
              </div>
            </div>
          </div>

          <div class="ticket-actions">
            <button
              class="primary"
              :disabled="capturandoCronograma || cronogramaServicios.length === 0"
              @click="capturarCronograma"
            >
              <IconLoader v-if="capturandoCronograma" :size="18" class="spin" />
              <IconCamera v-else :size="18" />
              {{ capturandoCronograma ? 'Capturando…' : 'Capturar ticket' }}
            </button>
          </div>
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
  margin: 0 0 1rem;
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

/* Ticket / constancia de pago */
.ticket-capture {
  border: 2px dashed var(--color-border);
  border-radius: 0.75rem;
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

/* Cronograma de deudas */
.head-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cronograma-servicio {
  margin-bottom: 1rem;
}

.cronograma-servicio:last-child {
  margin-bottom: 0;
}

.cronograma-pagos {
  margin: 0.5rem 0 0;
}

.cronograma-titulo {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-2);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cronograma-encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-2);
  text-transform: uppercase;
}

.cronograma-pago {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}

.cronograma-pago:last-child {
  border-bottom: none;
}

.cronograma-fecha {
  color: var(--color-text);
}

.cronograma-monto {
  font-weight: 600;
  color: var(--color-primary-dark);
}

.cronograma-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0;
  border-top: 2px solid var(--color-border);
  font-size: 0.9rem;
}

.cronograma-total strong {
  font-weight: 700;
}

.cronograma-total strong:last-child {
  color: var(--color-primary-dark);
}
</style>