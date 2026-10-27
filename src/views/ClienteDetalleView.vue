<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  IconCheck,
  IconClipboard,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconLoader,
  IconLock,
  IconLockOpen,
  IconNotebook,
  IconPlus,
  IconTools,
  IconTrash,
  IconUser,
  IconUsers,
  IconVault,
  IconX,
} from '@tabler/icons-vue'
import {
  getCliente,
  updateCliente,
  deleteCliente,
  listProyectos,
  createProyecto,
  updateProyecto,
  deleteProyecto,
  listServicios,
  createServicio,
  updateServicio,
  deleteServicio,
  crearPagosPendientes,
  listNotasPorCliente,
  createNota,
  updateNota,
  deleteNota,
  parseSocios,
  type Cliente,
  type Socio,
  type NotaRegistro,
  type Proyecto,
  type Servicio,
} from '../api/pocketbase'
import {
  encryptText,
  decryptText,
  getMasterPassword,
  hasMasterPassword,
  setMasterPassword,
  isMasterUnlocked,
  unlockMaster,
} from '../utils/crypto'
import { formatDate, truncate } from '../utils/format'
import { showToast } from '../utils/toast'
import { PERIOCIDAD_LABEL, fechasCuotas } from '../utils/cuotas'
import { showMontos, monto, montoVisible, toggleMontos } from '../utils/montos'
import Modal from '../components/Modal.vue'
import Breadcrumbs from '../components/Breadcrumbs.vue'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const cliente = ref<Cliente | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)

type Tab = 'socios' | 'notas' | 'proyectos' | 'servicios'
const TABS: Tab[] = ['socios', 'notas', 'proyectos', 'servicios']

function tabFromQuery(value: unknown): Tab {
  const v = Array.isArray(value) ? value[0] : value
  return TABS.includes(v as Tab) ? (v as Tab) : 'socios'
}

const tab = ref<Tab>(tabFromQuery(route.query.tab))

// Mantener la pestaña activa en la URL (permite enlazar a una pestaña concreta)
watch(tab, (t) => {
  if (route.query.tab !== t) {
    router.replace({ query: { ...route.query, tab: t } })
  }
})

// Si la URL cambia (ej. desde un enlace externo), sincronizar la pestaña
watch(
  () => route.query.tab,
  (value) => {
    const t = tabFromQuery(value)
    if (t !== tab.value) tab.value = t
  },
)

const socios = computed<Socio[]>(() => parseSocios(cliente.value?.socios))

// ---------- Notas y secretos (is_notas) ----------
const notasDb = ref<NotaRegistro[]>([])

/** Notas normales (texto plano) */
const notasPlanas = computed(() => notasDb.value.filter((n) => !n.oculto))
/** Secretos (texto cifrado) */
const secretos = computed(() => notasDb.value.filter((n) => n.oculto))

/** Textos cifrados de un secreto (array JSON) */
function secretoItems(nota: NotaRegistro): string[] {
  try {
    const value = JSON.parse(nota.dato || '[]')
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

/** Contenido revelado: clave `${notaId}:${index}` -> texto plano */
const revelados = ref<Record<string, string>>({})

function revealKey(nota: NotaRegistro, index: number): string {
  return `${nota.id}:${index}`
}

function estaRevelado(nota: NotaRegistro, index: number): boolean {
  return revelados.value[revealKey(nota, index)] !== undefined
}

function textoRevelado(nota: NotaRegistro, index: number): string {
  return revelados.value[revealKey(nota, index)] ?? ''
}

// Proyectos del cliente
const proyectos = ref<Proyecto[]>([])
const showProyectoForm = ref(false)
const proyectoForm = ref({
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

// Servicios del cliente
const servicios = ref<Servicio[]>([])
const showServicioForm = ref(false)
const servicioForm = ref({
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
    servicioForm.value.fecha_inicio,
    servicioForm.value.periocidad as Servicio['periocidad'],
    Number(servicioForm.value.num_cuotas) || 0,
  ),
)

/** Fecha final del servicio: la fecha de la última cuota */
const fechaFinalPreview = computed(() => {
  const fechas = cuotasPreview.value
  return fechas.length > 0 ? fechas[fechas.length - 1]! : ''
})

// Edición de servicio
const editingServicioId = ref<string | null>(null)
const servicioEditForm = ref({
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

// Edición de proyecto
const editingProyectoId = ref<string | null>(null)
const proyectoEditForm = ref({
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

const ESTADO_PROYECTO: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: '#1a7f37' },
  completado: { label: 'Completado', color: '#0969da' },
  cancelado: { label: 'Cancelado', color: '#e5484d' },
}

function estadoInfo(estado: string) {
  return ESTADO_PROYECTO[estado] ?? { label: estado, color: '#6e7781' }
}

function totalAdelantos(p: Proyecto): number {
  return Number(p.adelanto) || 0
}

function openProyectoEdit(p: Proyecto) {
  proyectoEditForm.value = {
    proyecto: p.proyecto ?? '',
    descripcion: p.descripcion ?? '',
    total: String(p.total ?? ''),
    adelanto: String(p.adelanto ?? ''),
    progreso: String(p.progreso ?? ''),
    estado: p.estado ?? 'activo',
    fecha_inicio: p.fecha_inicio ?? '',
    fecha_final: p.fecha_final ?? '',
    observaciones: p.observaciones ?? '',
  }
  editingProyectoId.value = p.id
}

async function saveProyectoEdit() {
  if (!editingProyectoId.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await updateProyecto(editingProyectoId.value, {
      proyecto: proyectoEditForm.value.proyecto,
      descripcion: proyectoEditForm.value.descripcion,
      total: Number(proyectoEditForm.value.total) || 0,
      adelanto: Number(proyectoEditForm.value.adelanto) || 0,
      progreso: Number(proyectoEditForm.value.progreso) || 0,
      estado: proyectoEditForm.value.estado as Proyecto['estado'],
      fecha_inicio: proyectoEditForm.value.fecha_inicio,
      fecha_final: proyectoEditForm.value.fecha_final,
      observaciones: proyectoEditForm.value.observaciones,
    })
    proyectos.value = proyectos.value.map((p) => (p.id === updated.id ? updated : p))
    editingProyectoId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar proyecto'
  } finally {
    saving.value = false
  }
}

async function eliminarProyecto() {
  if (!editingProyectoId.value) return
  if (!confirm('¿Eliminar este proyecto?')) return
  saving.value = true
  error.value = ''
  try {
    await deleteProyecto(editingProyectoId.value)
    proyectos.value = proyectos.value.filter((p) => p.id !== editingProyectoId.value)
    editingProyectoId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar proyecto'
  } finally {
    saving.value = false
  }
}

// Edición de datos generales
const editing = ref(false)
const editForm = ref({ nombre: '', celular: '', ruc: '', direccion: '', email: '' })

// Formularios de sub-registros
const showSocioForm = ref(false)
const socioForm = ref({ nombre: '', celular: '', cargo: '', ubicacion: '' })
const showNotaForm = ref(false)
const notaForm = ref({ titulo: '', dato: '' })

// Formulario de secreto (título + varios textos cifrados)
const showSecretoForm = ref(false)
const secretoForm = ref({ titulo: '', textos: [''] })
/** Indica si falta crear la clave maestra (al abrir el formulario de secreto) */
const sinClaveMaestra = ref(false)

// Prompt de clave maestra para revelar/editar secretos
const showKeyPrompt = ref(false)
const keyInput = ref('')
const keyError = ref('')
/** Cipher de referencia para validar la clave ingresada */
let pendingKeyCheck: string | null = null
/** Acción a ejecutar una vez validada la clave */
let pendingKeyAction: (() => void | Promise<void>) | null = null

// Edición de socio
const editingSocioIndex = ref<number | null>(null)
const socioEditForm = ref({ nombre: '', celular: '', cargo: '', ubicacion: '' })

function openSocioEdit(index: number) {
  const socio = socios.value[index]
  if (!socio) return
  socioEditForm.value = {
    nombre: socio.nombre ?? '',
    celular: socio.celular ?? '',
    cargo: socio.cargo ?? '',
    ubicacion: socio.ubicacion ?? '',
  }
  editingSocioIndex.value = index
}

async function saveSocioEdit() {
  if (!cliente.value || editingSocioIndex.value === null) return
  saving.value = true
  error.value = ''
  try {
    const next = socios.value.map((s, i) =>
      i === editingSocioIndex.value ? { ...socioEditForm.value } : s,
    )
    cliente.value = await updateCliente(cliente.value.id, { socios: next })
    editingSocioIndex.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar socio'
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [cli, proy, serv, nts] = await Promise.all([
      getCliente(id),
      listProyectos(),
      listServicios(),
      listNotasPorCliente(id),
    ])
    cliente.value = cli
    proyectos.value = proy.filter((p) => p.cliente_id === id)
    servicios.value = serv.filter((s) => s.cliente_id === id)
    notasDb.value = nts
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el cliente'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openServicioForm() {
  servicioForm.value = {
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
  showServicioForm.value = true
}

/** Mantiene fecha_final sincronizada con la fecha de la última cuota */
function actualizarFechaFinal() {
  servicioForm.value.fecha_final = fechaFinalPreview.value
}

// Si cambia la fecha de inicio, la periocidad o el número de cuotas, recalcular la fecha final
watch(
  [
    () => servicioForm.value.fecha_inicio,
    () => servicioForm.value.periocidad,
    () => servicioForm.value.num_cuotas,
  ],
  actualizarFechaFinal,
)

async function guardarServicio() {
  if (!cliente.value || !servicioForm.value.servicio) return
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
      cliente_id: cliente.value.id,
      servicio: servicioForm.value.servicio,
      descripcion: servicioForm.value.descripcion,
      total: Number(servicioForm.value.total) || 0,
      periocidad: servicioForm.value.periocidad as Servicio['periocidad'],
      duracion_dias: Number(servicioForm.value.duracion_dias) || 0,
      estado: servicioForm.value.estado as Servicio['estado'],
      fecha_inicio: servicioForm.value.fecha_inicio,
      fecha_final: fechaFinal,
      observaciones: servicioForm.value.observaciones,
    })

    // Crear una cuota pendiente por cada fecha calculada (mismo monto en cada una)
    await crearPagosPendientes(servicio.id, fechas, Number(servicio.total) || 0)

    showServicioForm.value = false
    router.push(`/servicio/${servicio.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar servicio'
  } finally {
    saving.value = false
  }
}

function openServicioEdit(s: Servicio) {
  servicioEditForm.value = {
    servicio: s.servicio ?? '',
    descripcion: s.descripcion ?? '',
    total: String(s.total ?? ''),
    periocidad: s.periocidad ?? 'mensual',
    duracion_dias: String(s.duracion_dias ?? 0),
    estado: s.estado ?? 'activo',
    fecha_inicio: s.fecha_inicio ?? '',
    fecha_final: s.fecha_final ?? '',
    observaciones: s.observaciones ?? '',
  }
  editingServicioId.value = s.id
}

async function saveServicioEdit() {
  if (!editingServicioId.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await updateServicio(editingServicioId.value, {
      servicio: servicioEditForm.value.servicio,
      descripcion: servicioEditForm.value.descripcion,
      total: Number(servicioEditForm.value.total) || 0,
      periocidad: servicioEditForm.value.periocidad as Servicio['periocidad'],
      duracion_dias: Number(servicioEditForm.value.duracion_dias) || 0,
      estado: servicioEditForm.value.estado as Servicio['estado'],
      fecha_inicio: servicioEditForm.value.fecha_inicio,
      fecha_final: servicioEditForm.value.fecha_final,
      observaciones: servicioEditForm.value.observaciones,
    })
    servicios.value = servicios.value.map((s) => (s.id === updated.id ? updated : s))
    editingServicioId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar servicio'
  } finally {
    saving.value = false
  }
}

async function eliminarServicio() {
  if (!editingServicioId.value) return
  if (!confirm('¿Eliminar este servicio?')) return
  saving.value = true
  error.value = ''
  try {
    await deleteServicio(editingServicioId.value)
    servicios.value = servicios.value.filter((s) => s.id !== editingServicioId.value)
    editingServicioId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar servicio'
  } finally {
    saving.value = false
  }
}

function openProyectoForm() {
  proyectoForm.value = {
    proyecto: '',
    descripcion: '',
    total: '',
    adelanto: '',
    progreso: '',
    estado: 'activo',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_final: '',
    observaciones: '',
  }
  showProyectoForm.value = true
}

async function guardarProyecto() {
  if (!cliente.value || !proyectoForm.value.proyecto) return
  saving.value = true
  error.value = ''
  try {
    // Crear el proyecto vinculado al cliente
    const proyecto = await createProyecto({
      cliente_id: cliente.value.id,
      proyecto: proyectoForm.value.proyecto,
      descripcion: proyectoForm.value.descripcion,
      total: Number(proyectoForm.value.total) || 0,
      adelanto: Number(proyectoForm.value.adelanto) || 0,
      progreso: Number(proyectoForm.value.progreso) || 0,
      estado: proyectoForm.value.estado as Proyecto['estado'],
      fecha_inicio: proyectoForm.value.fecha_inicio,
      fecha_final: proyectoForm.value.fecha_final,
      observaciones: proyectoForm.value.observaciones,
    })

    showProyectoForm.value = false
    // Redirigir al perfil del proyecto recién creado
    router.push(`/proyecto/${proyecto.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar proyecto'
  } finally {
    saving.value = false
  }
}

function startEdit() {
  if (!cliente.value) return
  editForm.value = {
    nombre: cliente.value.nombre ?? '',
    celular: cliente.value.celular ?? '',
    ruc: cliente.value.ruc ?? '',
    direccion: cliente.value.direccion ?? '',
    email: cliente.value.email ?? '',
  }
  editing.value = true
}

async function saveEdit() {
  if (!cliente.value) return
  saving.value = true
  error.value = ''
  try {
    cliente.value = await updateCliente(cliente.value.id, editForm.value)
    editing.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function eliminar() {
  if (!cliente.value) return
  if (!confirm(`¿Eliminar a "${cliente.value.nombre}"?`)) return
  saving.value = true
  error.value = ''
  try {
    await deleteCliente(cliente.value.id)
    router.push('/cliente')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar cliente'
    saving.value = false
  }
}

async function addSocio() {
  if (!cliente.value || !socioForm.value.nombre) return
  saving.value = true
  error.value = ''
  try {
    const socio: Socio = { ...socioForm.value }
    cliente.value = await updateCliente(cliente.value.id, { socios: [...socios.value, socio] })
    socioForm.value = { nombre: '', celular: '', cargo: '', ubicacion: '' }
    showSocioForm.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar socio'
  } finally {
    saving.value = false
  }
}

async function removeSocio(index: number) {
  if (!cliente.value) return
  saving.value = true
  error.value = ''
  try {
    const next = socios.value.filter((_, i) => i !== index)
    cliente.value = await updateCliente(cliente.value.id, { socios: next })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar socio'
  } finally {
    saving.value = false
  }
}

async function addNota() {
  if (!cliente.value || !notaForm.value.titulo) return
  saving.value = true
  error.value = ''
  try {
    const creada = await createNota({
      cliente_id: cliente.value.id,
      titulo: notaForm.value.titulo,
      dato: notaForm.value.dato,
      dato_extra: '',
      oculto: false,
    })
    notasDb.value = [creada, ...notasDb.value]
    showNotaForm.value = false
    notaForm.value = { titulo: '', dato: '' }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar nota'
  } finally {
    saving.value = false
  }
}

async function borrarNota(nota: NotaRegistro) {
  saving.value = true
  error.value = ''
  try {
    await deleteNota(nota.id)
    notasDb.value = notasDb.value.filter((n) => n.id !== nota.id)
    // Limpia el contenido revelado de esa nota
    for (const k of Object.keys(revelados.value)) {
      if (k.startsWith(`${nota.id}:`)) delete revelados.value[k]
    }
    showToast('Eliminado', 'success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar nota'
  } finally {
    saving.value = false
  }
}

/** Copia al portapapeles solo el dato de la nota (sin el título) */
async function copiarNota(nota: NotaRegistro) {
  if (!nota.dato) return
  try {
    await navigator.clipboard.writeText(nota.dato)
    showToast('Dato copiado al portapapeles', 'success')
  } catch {
    showToast('No se pudo copiar', 'error')
  }
}

/** Elimina una nota normal (texto plano) */
function eliminarNota(nota: NotaRegistro) {
  if (!confirm(`¿Eliminar "${nota.titulo}"?`)) return
  void borrarNota(nota)
}

/** Elimina un secreto: requiere la clave maestra */
function eliminarSecreto(secreto: NotaRegistro) {
  if (!confirm(`¿Eliminar "${secreto.titulo}"?`)) return
  promptMasterKey(secretoItems(secreto)[0] ?? '', () => borrarNota(secreto))
}

// ---------- Secretos ----------
function openSecretoForm() {
  secretoForm.value = { titulo: '', textos: [''] }
  error.value = ''
  sinClaveMaestra.value = !hasMasterPassword()
  showSecretoForm.value = true
}

function addTextoSecreto() {
  secretoForm.value.textos.push('')
}

function removeTextoSecreto(index: number) {
  secretoForm.value.textos.splice(index, 1)
  if (secretoForm.value.textos.length === 0) secretoForm.value.textos.push('')
}

/** Cifra cada texto y guarda el secreto (oculto = true) */
async function crearSecreto() {
  if (!cliente.value || !secretoForm.value.titulo) return
  const textos = secretoForm.value.textos.map((t) => t.trim()).filter(Boolean)
  if (textos.length === 0) {
    error.value = 'Agrega al menos un texto secreto.'
    return
  }
  const pass = getMasterPassword()
  if (!pass) {
    error.value = 'Aún no has creado tu clave maestra. Ve a Opciones para asignarla.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const cifrados: string[] = []
    for (const t of textos) cifrados.push(await encryptText(t, pass))
    const creado = await createNota({
      cliente_id: cliente.value.id,
      titulo: secretoForm.value.titulo,
      dato: JSON.stringify(cifrados),
      dato_extra: '',
      oculto: true,
    })
    notasDb.value = [creado, ...notasDb.value]
    showSecretoForm.value = false
    secretoForm.value = { titulo: '', textos: [''] }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al crear el secreto'
  } finally {
    saving.value = false
  }
}

/** Intenta descifrar un item y lo guarda en el mapa de revelados */
async function intentarDescifrar(
  payload: string,
  pass: string,
  nota: NotaRegistro,
  index: number,
): Promise<boolean> {
  try {
    const texto = await decryptText(payload, pass)
    revelados.value[revealKey(nota, index)] = texto
    return true
  } catch {
    return false
  }
}

/** Revela un texto del secreto (pide la clave si el desbloqueo expiró) */
function revelar(nota: NotaRegistro, index: number) {
  const payload = secretoItems(nota)[index]
  if (!payload) return
  promptMasterKey(payload, async () => {
    const pass = getMasterPassword()
    if (pass) await intentarDescifrar(payload, pass, nota, index)
  })
}

function ocultarRevelado(nota: NotaRegistro, index: number) {
  delete revelados.value[revealKey(nota, index)]
}

/** Copia un texto del secreto al portapapeles (requiere la clave maestra) */
function copiarSecreto(nota: NotaRegistro, index: number) {
  const payload = secretoItems(nota)[index]
  if (!payload) return
  promptMasterKey(payload, async () => {
    const pass = getMasterPassword()
    if (!pass) return
    // Usa el texto ya revelado si existe; si no, descifra SIN revelarlo en pantalla
    let texto = revelados.value[revealKey(nota, index)]
    if (texto === undefined) {
      try {
        texto = await decryptText(payload, pass)
      } catch {
        showToast('No se pudo descifrar', 'error')
        return
      }
    }
    try {
      await navigator.clipboard.writeText(texto)
      showToast('Copiado al portapapeles', 'success')
    } catch {
      showToast('No se pudo copiar', 'error')
    }
  })
}

/**
 * Pide la clave maestra (si el desbloqueo de 5 min expiró) y ejecuta `action`.
 * `check` es un texto cifrado de referencia para validar la clave ingresada.
 */
function promptMasterKey(check: string, action: () => void | Promise<void>) {
  const pass = getMasterPassword()
  if (pass && isMasterUnlocked()) {
    void action()
    return
  }
  pendingKeyCheck = check || null
  pendingKeyAction = action
  keyInput.value = ''
  keyError.value = ''
  showKeyPrompt.value = true
}

async function confirmarClave() {
  const pass = keyInput.value
  if (!pass || !pendingKeyAction) return
  // Valida la clave descifrando el texto de referencia (si lo hay)
  if (pendingKeyCheck) {
    try {
      await decryptText(pendingKeyCheck, pass)
    } catch {
      keyError.value = 'Clave incorrecta.'
      return
    }
  }
  // Recuerda la clave en la sesión y la desbloquea 5 minutos
  setMasterPassword(pass)
  unlockMaster()
  const action = pendingKeyAction
  pendingKeyAction = null
  pendingKeyCheck = null
  showKeyPrompt.value = false
  await action()
}

// ---------- Edición de notas y secretos ----------
const editingNotaId = ref<string | null>(null)
const notaEditForm = ref({ titulo: '', dato: '' })

function openNotaEdit(nota: NotaRegistro) {
  notaEditForm.value = { titulo: nota.titulo, dato: nota.dato }
  editingNotaId.value = nota.id
}

async function saveNotaEdit() {
  if (!editingNotaId.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await updateNota(editingNotaId.value, {
      titulo: notaEditForm.value.titulo,
      dato: notaEditForm.value.dato,
    })
    notasDb.value = notasDb.value.map((n) => (n.id === updated.id ? updated : n))
    editingNotaId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar nota'
  } finally {
    saving.value = false
  }
}

const editingSecretoId = ref<string | null>(null)
const secretoEditForm = ref({ titulo: '', textos: [''] })

/** Abre la edición de un secreto (requiere la clave maestra) */
function openSecretoEdit(secreto: NotaRegistro) {
  const items = secretoItems(secreto)
  promptMasterKey(items[0] ?? '', async () => {
    const pass = getMasterPassword()
    if (!pass) return
    const textos: string[] = []
    for (const c of items) {
      try {
        textos.push(await decryptText(c, pass))
      } catch {
        textos.push('')
      }
    }
    if (textos.length === 0) textos.push('')
    secretoEditForm.value = { titulo: secreto.titulo, textos }
    editingSecretoId.value = secreto.id
  })
}

function addTextoSecretoEdit() {
  secretoEditForm.value.textos.push('')
}

function removeTextoSecretoEdit(index: number) {
  secretoEditForm.value.textos.splice(index, 1)
  if (secretoEditForm.value.textos.length === 0) secretoEditForm.value.textos.push('')
}

async function saveSecretoEdit() {
  if (!editingSecretoId.value) return
  const pass = getMasterPassword()
  if (!pass) {
    error.value = 'Aún no has creado tu clave maestra. Ve a Opciones para asignarla.'
    return
  }
  const textos = secretoEditForm.value.textos.map((t) => t.trim()).filter(Boolean)
  if (textos.length === 0) {
    error.value = 'Agrega al menos un texto secreto.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const cifrados: string[] = []
    for (const t of textos) cifrados.push(await encryptText(t, pass))
    const updated = await updateNota(editingSecretoId.value, {
      titulo: secretoEditForm.value.titulo,
      dato: JSON.stringify(cifrados),
      oculto: true,
    })
    notasDb.value = notasDb.value.map((n) => (n.id === updated.id ? updated : n))
    // Limpia el contenido revelado del secreto editado
    for (const k of Object.keys(revelados.value)) {
      if (k.startsWith(`${updated.id}:`)) delete revelados.value[k]
    }
    editingSecretoId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar el secreto'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main>
    <Breadcrumbs :items="[{ label: 'Clientes', to: '/cliente' }, { label: cliente?.nombre ?? '…' }]" />

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <template v-else-if="cliente">
      <div class="head">
        <h1>{{ cliente.nombre }}</h1>
        <div class="head-actions">
          <button
            class="ghost"
            :title="showMontos ? 'Ocultar montos' : 'Ver montos'"
            @click="toggleMontos"
          >
            <IconEyeOff v-if="showMontos" :size="18" />
            <IconEye v-else :size="18" />
            {{ showMontos ? 'Ocultar montos' : 'Ver montos' }}
          </button>
          <button v-if="!editing" class="primary" @click="startEdit">
            <IconEdit :size="18" /> Editar
          </button>
          <button class="danger" :disabled="saving" @click="eliminar">
            <IconTrash :size="18" /> Eliminar
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- Datos generales -->
      <section v-if="!editing" class="card">
        <dl class="fields">
          <div><dt>Celular</dt><dd>{{ cliente.celular || '—' }}</dd></div>
          <div><dt>RUC</dt><dd>{{ cliente.ruc || '—' }}</dd></div>
          <div><dt>Email</dt><dd>{{ cliente.email || '—' }}</dd></div>
          <div><dt>Dirección</dt><dd>{{ cliente.direccion || '—' }}</dd></div>
        </dl>
      </section>

      <Modal v-if="editing" title="Editar cliente" @close="editing = false">
        <form class="form" @submit.prevent="saveEdit">
          <div class="grid">
            <label>
              Nombre *
              <input v-model="editForm.nombre" type="text" required />
            </label>
            <label>
              Celular
              <input v-model="editForm.celular" type="text" />
            </label>
            <label>
              RUC
              <input v-model="editForm.ruc" type="text" />
            </label>
            <label>
              Email
              <input v-model="editForm.email" type="email" />
            </label>
            <label class="full">
              Dirección
              <input v-model="editForm.direccion" type="text" />
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
          </div>
        </form>
      </Modal>

      <!-- Pestañas -->
      <nav class="tabs">
        <button :class="{ active: tab === 'socios' }" @click="tab = 'socios'">
          <IconUsers :size="16" /> Socios ({{ socios.length }})
        </button>
        <button :class="{ active: tab === 'notas' }" @click="tab = 'notas'">
          <IconNotebook :size="16" /> Notas y secretos ({{ notasDb.length }})
        </button>
        <button :class="{ active: tab === 'proyectos' }" @click="tab = 'proyectos'">
          <IconFolder :size="16" /> Proyectos ({{ proyectos.length }})
        </button>
        <button :class="{ active: tab === 'servicios' }" @click="tab = 'servicios'">
          <IconTools :size="16" /> Servicios ({{ servicios.length }})
        </button>
      </nav>

      <!-- Socios -->
      <div v-if="tab === 'socios'" class="tab-head">
        <h2>Socios</h2>
        <button class="primary" @click="showSocioForm = true">
          <IconPlus :size="16" /> Agregar socio
        </button>
      </div>

      <section v-if="tab === 'socios'" class="card">

        <Modal v-if="showSocioForm" title="Nuevo socio" @close="showSocioForm = false">
          <form class="form" @submit.prevent="addSocio">
            <div class="grid">
              <label>
                Nombre *
                <input v-model="socioForm.nombre" type="text" required />
              </label>
              <label>
                Celular
                <input v-model="socioForm.celular" type="text" />
              </label>
              <label>
                Cargo
                <input v-model="socioForm.cargo" type="text" />
              </label>
              <label>
                Ubicación
                <input v-model="socioForm.ubicacion" type="text" />
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconPlus v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="showSocioForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <p v-if="socios.length === 0" class="muted">Sin socios registrados.</p>

        <ul v-else class="list">
          <li v-for="(socio, i) in socios" :key="i">
            <button class="socio-item" type="button" @click="openSocioEdit(i)">
              <IconUser :size="16" class="socio-icon" />
              <strong>{{ socio.nombre }}</strong>
              <span v-if="socio.cargo"> · {{ socio.cargo }}</span>
              <span v-if="socio.celular"> · {{ socio.celular }}</span>
              <span v-if="socio.ubicacion"> · {{ socio.ubicacion }}</span>
            </button>
            <button class="danger" title="Eliminar socio" @click="removeSocio(i)">
              <IconTrash :size="16" />
            </button>
          </li>
        </ul>

        <Modal
          v-if="editingSocioIndex !== null"
          title="Editar socio"
          @close="editingSocioIndex = null"
        >
          <form class="form" @submit.prevent="saveSocioEdit">
            <div class="grid">
              <label>
                Nombre *
                <input v-model="socioEditForm.nombre" type="text" required />
              </label>
              <label>
                Celular
                <input v-model="socioEditForm.celular" type="text" />
              </label>
              <label>
                Cargo
                <input v-model="socioEditForm.cargo" type="text" />
              </label>
              <label>
                Ubicación
                <input v-model="socioEditForm.ubicacion" type="text" />
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCheck v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="editingSocioIndex = null">Cancelar</button>
            </div>
          </form>
        </Modal>
      </section>

      <!-- Notas -->
      <div v-if="tab === 'notas'" class="tab-head">
        <h2>Notas y secretos</h2>
        <div class="tab-actions">
          <button class="ghost" @click="openSecretoForm">
            <IconLock :size="16" /> Crear secreto
          </button>
          <button class="primary" @click="showNotaForm = true">
            <IconPlus :size="16" /> Agregar nota
          </button>
        </div>
      </div>

      <section v-if="tab === 'notas'" class="card">

        <!-- Nueva nota (texto plano) -->
        <Modal v-if="showNotaForm" title="Nueva nota" size="sm" @close="showNotaForm = false">
          <form class="form" @submit.prevent="addNota">
            <div class="grid">
              <label class="full">
                Título *
                <input v-model="notaForm.titulo" type="text" required />
              </label>
              <label class="full">
                Dato
                <textarea v-model="notaForm.dato" placeholder="Dato (texto)"></textarea>
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconPlus v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="showNotaForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <!-- Nuevo secreto (varios textos cifrados) -->
        <Modal v-if="showSecretoForm" title="Crear secreto" size="sm" @close="showSecretoForm = false">
          <form class="form" @submit.prevent="crearSecreto">
            <div class="grid">
              <label class="full">
                Título *
                <input v-model="secretoForm.titulo" type="text" required />
              </label>
            </div>

            <div class="secretos-form">
              <label v-for="(_, i) in secretoForm.textos" :key="i" class="secreto-input">
                <span class="dato-label"><IconLock :size="14" /> Dato {{ i + 1 }}</span>
                <div class="secreto-input-row">
                  <input v-model="secretoForm.textos[i]" type="text" />
                  <button
                    type="button"
                    class="danger icon-btn"
                    title="Quitar texto"
                    @click="removeTextoSecreto(i)"
                  >
                    <IconTrash :size="16" />
                  </button>
                </div>
              </label>
              <button type="button" class="ghost" @click="addTextoSecreto">
                <IconPlus :size="16" /> Agregar texto
              </button>
            </div>

            <p v-if="sinClaveMaestra" class="hint warn-hint">
              Aún no has creado una clave maestra.
              Ve a <RouterLink to="/opciones">Opciones</RouterLink> para asignarla.
            </p>
            <p v-else class="hint">
              Los textos se cifran con tu clave maestra (AES-GCM).
            </p>

            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconLock v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar secreto' }}
              </button>
              <button type="button" class="ghost" @click="showSecretoForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <p v-if="notasDb.length === 0" class="muted">Sin notas registradas.</p>

        <template v-else>
          <!-- Notas -->
          <ul v-if="notasPlanas.length > 0" class="list notas">
            <li v-for="nota in notasPlanas" :key="nota.id">
              <div>
                <strong>{{ nota.titulo }}</strong>
                <p v-if="nota.dato" class="pre">{{ nota.dato }}</p>
              </div>
              <div class="item-actions">
                <button
                  v-if="nota.dato"
                  class="ghost reveal-btn"
                  type="button"
                  title="Copiar dato"
                  @click="copiarNota(nota)"
                >
                  <IconClipboard :size="16" /> Copiar
                </button>
                <button class="edit-btn" title="Editar nota" @click="openNotaEdit(nota)">
                  <IconEdit :size="16" />
                </button>
                <button class="danger" title="Eliminar nota" @click="eliminarNota(nota)">
                  <IconTrash :size="16" />
                </button>
              </div>
            </li>
          </ul>

          <!-- Secretos -->
          <h3 v-if="secretos.length > 0" class="sub-title">
            <IconLock :size="16" /> Caja fuerte
          </h3>
          <ul v-if="secretos.length > 0" class="list secretos">
            <li v-for="s in secretos" :key="s.id">
              <div class="secreto-body">
                <strong class="secreto-titulo"><IconVault :size="16" /> {{ s.titulo }}</strong>
                <div class="secreto-items">
                  <div v-for="(_, i) in secretoItems(s)" :key="i" class="secreto-item">
                    <span v-if="estaRevelado(s, i)" class="secreto-texto">
                      {{ textoRevelado(s, i) }}
                    </span>
                    <span v-else class="secreto-oculto">••••••••</span>
                    <button
                      v-if="!estaRevelado(s, i)"
                      class="ghost reveal-btn"
                      type="button"
                      @click="revelar(s, i)"
                    >
                      <IconLockOpen :size="16" /> Revelar
                    </button>
                    <button
                      v-else
                      class="ghost reveal-btn"
                      type="button"
                      @click="ocultarRevelado(s, i)"
                    >
                      <IconLock :size="16" /> Ocultar
                    </button>
                    <button
                      class="ghost reveal-btn"
                      type="button"
                      title="Copiar"
                      @click="copiarSecreto(s, i)"
                    >
                      <IconClipboard :size="16" /> Copiar
                    </button>
                  </div>
                </div>
              </div>
              <div class="item-actions">
                <button class="edit-btn" title="Editar secreto" @click="openSecretoEdit(s)">
                  <IconEdit :size="16" />
                </button>
                <button class="danger" title="Eliminar secreto" @click="eliminarSecreto(s)">
                  <IconTrash :size="16" />
                </button>
              </div>
            </li>
          </ul>
        </template>

        <!-- Editar nota -->
        <Modal v-if="editingNotaId" title="Editar nota" size="sm" @close="editingNotaId = null">
          <form class="form" @submit.prevent="saveNotaEdit">
            <div class="grid">
              <label class="full">
                Título *
                <input v-model="notaEditForm.titulo" type="text" required />
              </label>
              <label class="full">
                Dato
                <textarea v-model="notaEditForm.dato" placeholder="Dato (texto)"></textarea>
              </label>
            </div>
            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCheck v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="editingNotaId = null">Cancelar</button>
            </div>
          </form>
        </Modal>

        <!-- Editar secreto (requiere clave maestra) -->
        <Modal
          v-if="editingSecretoId"
          title="Editar secreto"
          size="sm"
          @close="editingSecretoId = null"
        >
          <form class="form" @submit.prevent="saveSecretoEdit">
            <div class="grid">
              <label class="full">
                Título *
                <input v-model="secretoEditForm.titulo" type="text" required />
              </label>
            </div>

            <div class="secretos-form">
              <label v-for="(_, i) in secretoEditForm.textos" :key="i" class="secreto-input">
                <span class="dato-label"><IconLock :size="14" /> Dato {{ i + 1 }}</span>
                <div class="secreto-input-row">
                  <input v-model="secretoEditForm.textos[i]" type="text" />
                  <button
                    type="button"
                    class="danger icon-btn"
                    title="Quitar texto"
                    @click="removeTextoSecretoEdit(i)"
                  >
                    <IconTrash :size="16" />
                  </button>
                </div>
              </label>
              <button type="button" class="ghost" @click="addTextoSecretoEdit">
                <IconPlus :size="16" /> Agregar texto
              </button>
            </div>

            <p class="hint">Al guardar, los textos se vuelven a cifrar con tu clave maestra.</p>

            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconLock v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar secreto' }}
              </button>
              <button type="button" class="ghost" @click="editingSecretoId = null">Cancelar</button>
            </div>
          </form>
        </Modal>

        <!-- Prompt de clave maestra para revelar/editar -->
        <Modal v-if="showKeyPrompt" title="Clave maestra" size="sm" @close="showKeyPrompt = false">
          <form class="form" @submit.prevent="confirmarClave">
            <p class="hint">Ingresa tu clave maestra para continuar.</p>
            <label>
              Clave
              <input v-model="keyInput" type="password" autocomplete="off" required />
            </label>
            <p v-if="keyError" class="error">{{ keyError }}</p>
            <div class="row">
              <button type="submit" class="primary">
                <IconLockOpen :size="18" /> Continuar
              </button>
              <button type="button" class="ghost" @click="showKeyPrompt = false">Cancelar</button>
            </div>
          </form>
        </Modal>
      </section>

      <div v-if="tab === 'proyectos'" class="tab-head">
        <h2>Proyectos</h2>
        <div class="tab-actions">
          <button class="primary" @click="openProyectoForm">
            <IconPlus :size="16" /> Nuevo proyecto
          </button>
        </div>
      </div>

      <section v-if="tab === 'proyectos'" class="card">
        <Modal v-if="showProyectoForm" title="Nuevo proyecto" @close="showProyectoForm = false">
          <form class="form" @submit.prevent="guardarProyecto">
            <div class="grid">
              <label class="full">
                Proyecto *
                <input v-model="proyectoForm.proyecto" type="text" required />
              </label>
              <label class="full">
                Descripción
                <textarea v-model="proyectoForm.descripcion" rows="3"></textarea>
              </label>
              <label>
                Total (S/)
                <input v-model="proyectoForm.total" type="number" min="0" step="0.01" />
              </label>
              <label>
                Adelanto (S/)
                <input v-model="proyectoForm.adelanto" type="number" min="0" step="0.01" />
              </label>
              <label>
                Progreso (%)
                <input v-model="proyectoForm.progreso" type="number" min="0" max="100" step="1" />
              </label>
              <label>
                Fecha inicio
                <input v-model="proyectoForm.fecha_inicio" type="date" />
              </label>
              <label>
                Fecha final
                <input v-model="proyectoForm.fecha_final" type="date" />
              </label>
              <label class="full">
                Observaciones
                <textarea v-model="proyectoForm.observaciones" rows="2"></textarea>
              </label>
            </div>

            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconPlus v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="showProyectoForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <Modal
          v-if="editingProyectoId"
          title="Editar proyecto"
          @close="editingProyectoId = null"
        >
          <form class="form" @submit.prevent="saveProyectoEdit">
            <div class="grid">
              <label class="full">
                Proyecto *
                <input v-model="proyectoEditForm.proyecto" type="text" required />
              </label>
              <label class="full">
                Descripción
                <textarea v-model="proyectoEditForm.descripcion" rows="3"></textarea>
              </label>
              <label>
                Total (S/)
                <input v-model="proyectoEditForm.total" type="number" min="0" step="0.01" />
              </label>
              <label>
                Adelanto (S/)
                <input v-model="proyectoEditForm.adelanto" type="number" min="0" step="0.01" />
              </label>
              <label>
                Progreso (%)
                <input v-model="proyectoEditForm.progreso" type="number" min="0" max="100" step="1" />
              </label>
              <label>
                Estado
                <select v-model="proyectoEditForm.estado">
                  <option value="activo">Activo</option>
                  <option value="completado">Completado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </label>
              <label>
                Fecha inicio
                <input v-model="proyectoEditForm.fecha_inicio" type="date" />
              </label>
              <label>
                Fecha final
                <input v-model="proyectoEditForm.fecha_final" type="date" />
              </label>
              <label class="full">
                Observaciones
                <textarea v-model="proyectoEditForm.observaciones" rows="2"></textarea>
              </label>
            </div>

            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCheck v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="editingProyectoId = null">Cancelar</button>
              <button type="button" class="danger" :disabled="saving" @click="eliminarProyecto">
                <IconTrash :size="18" /> Eliminar
              </button>
            </div>
          </form>
        </Modal>

        <p v-if="proyectos.length === 0" class="muted">Esta pestaña aún no está configurada.</p>

        <div v-else class="proy-cards">
          <RouterLink
            v-for="p in proyectos"
            :key="p.id"
            :to="`/proyecto/${p.id}`"
            class="proy-card"
          >
            <div class="proy-top">
              <strong class="proy-name">{{ p.proyecto }}</strong>
              <button
                class="ghost icon-btn"
                type="button"
                title="Editar datos iniciales"
                @click.prevent="openProyectoEdit(p)"
              >
                <IconEdit :size="16" />
              </button>
            </div>

            <p v-if="p.descripcion" class="proy-desc">{{ truncate(p.descripcion) }}</p>

            <div class="proy-total">
              {{ monto(p.total) }}
            </div>

            <div class="proy-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${Math.min(Number(p.progreso) || 0, 100)}%` }"></div>
              </div>
              <span class="progress-label">{{ Number(p.progreso) || 0 }}%</span>
            </div>

            <div class="proy-bottom">
              <span
                v-if="p.estado !== 'activo'"
                class="badge"
                :style="{ color: estadoInfo(p.estado).color, background: `${estadoInfo(p.estado).color}1f` }"
              >
                <IconCheck v-if="p.estado === 'completado'" :size="14" />
                <IconX v-else-if="p.estado === 'cancelado'" :size="14" />
                <IconFolder v-else :size="14" />
                {{ estadoInfo(p.estado).label }}
              </span>
              <span class="proy-adelanto">
                Adelantos:
                {{ monto(totalAdelantos(p)) }}
              </span>
            </div>
          </RouterLink>
        </div>
      </section>

      <!-- Servicios -->
      <div v-if="tab === 'servicios'" class="tab-head">
        <h2>Servicios</h2>
        <button class="primary" @click="openServicioForm">
          <IconPlus :size="16" /> Nuevo servicio
        </button>
      </div>

      <section v-if="tab === 'servicios'" class="card">
        <Modal v-if="showServicioForm" title="Nuevo servicio" @close="showServicioForm = false">
          <form class="form" @submit.prevent="guardarServicio">
            <div class="grid">
              <label class="full">
                Servicio *
                <input v-model="servicioForm.servicio" type="text" required />
              </label>
              <label class="full">
                Descripción
                <textarea v-model="servicioForm.descripcion" rows="3"></textarea>
              </label>
              <label>
                Total (S/)
                <input v-model="servicioForm.total" type="number" min="0" step="0.01" />
              </label>
              <label>
                Periocidad
                <select v-model="servicioForm.periocidad">
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                  <option value="bianual">Bianual</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label>
                Fecha inicio
                <input v-model="servicioForm.fecha_inicio" type="date" required />
              </label>
              <label>
                Num. cuotas *
                <input v-model="servicioForm.num_cuotas" type="number" min="1" step="1" required />
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
                    <span class="cuota-monto">{{ montoVisible(Number(servicioForm.total) || 0) }}</span>
                  </li>
                </ul>
                <div class="cuotas-total">
                  <strong>Total a cobrar</strong>
                  <strong>{{ montoVisible((Number(servicioForm.total) || 0) * cuotasPreview.length) }}</strong>
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
              <button type="button" class="ghost" @click="showServicioForm = false">Cancelar</button>
            </div>
          </form>
        </Modal>

        <p v-if="servicios.length === 0" class="muted">Esta pestaña aún no está configurada.</p>

        <div v-else class="proy-cards">
          <RouterLink
            v-for="s in servicios"
            :key="s.id"
            :to="`/servicio/${s.id}`"
            class="proy-card"
          >
            <div class="proy-top">
              <strong class="proy-name">{{ s.servicio }}</strong>
              <button
                class="ghost icon-btn"
                type="button"
                title="Editar datos iniciales"
                @click.prevent="openServicioEdit(s)"
              >
                <IconEdit :size="16" />
              </button>
            </div>

            <p v-if="s.descripcion" class="proy-desc">{{ truncate(s.descripcion) }}</p>

            <div class="proy-total">
              {{ monto(s.total) }}
            </div>

            <div class="proy-bottom">
              <span class="badge" :class="`estado-${s.estado}`">
                {{ s.estado }}
              </span>
              <span class="proy-adelanto">{{ PERIOCIDAD_LABEL[s.periocidad] }}</span>
            </div>
          </RouterLink>
        </div>

        <Modal
          v-if="editingServicioId"
          title="Editar servicio"
          @close="editingServicioId = null"
        >
          <form class="form" @submit.prevent="saveServicioEdit">
            <div class="grid">
              <label class="full">
                Servicio *
                <input v-model="servicioEditForm.servicio" type="text" required />
              </label>
              <label class="full">
                Descripción
                <textarea v-model="servicioEditForm.descripcion" rows="3"></textarea>
              </label>
              <label>
                Total (S/)
                <input v-model="servicioEditForm.total" type="number" min="0" step="0.01" />
              </label>
              <label>
                Periocidad
                <select v-model="servicioEditForm.periocidad">
                  <option value="diario">Diario</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensual">Mensual</option>
                  <option value="bianual">Bianual</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label>
                Duración (días)
                <input v-model="servicioEditForm.duracion_dias" type="number" min="0" step="1" />
              </label>
              <label>
                Estado
                <select v-model="servicioEditForm.estado">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </label>
              <label>
                Fecha inicio
                <input v-model="servicioEditForm.fecha_inicio" type="date" />
              </label>
              <label>
                Fecha final
                <input v-model="servicioEditForm.fecha_final" type="date" />
              </label>
              <label class="full">
                Observaciones
                <textarea v-model="servicioEditForm.observaciones" rows="2"></textarea>
              </label>
            </div>

            <p v-if="error" class="error">{{ error }}</p>
            <div class="row">
              <button type="submit" class="primary" :disabled="saving">
                <IconLoader v-if="saving" :size="18" class="spin" />
                <IconCheck v-else :size="18" />
                {{ saving ? 'Guardando…' : 'Guardar' }}
              </button>
              <button type="button" class="ghost" @click="editingServicioId = null">Cancelar</button>
              <button type="button" class="danger" :disabled="saving" @click="eliminarServicio">
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
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.head h1 {
  flex: 1 1 100%;
  margin: 0;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: var(--color-background-soft);
  margin-top: 1rem;
}

.card h2 {
  font-size: 1.1rem;
  margin: 0;
}

.tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.tab-head + .card {
  margin-top: 0.5rem;
}

.tab-head h2 {
  margin: 0;
}

.tab-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.proy-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.proy-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-background);
  color: var(--color-text);
  text-decoration: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.proy-card:hover {
  border-color: hsl(var(--primary) / 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.proy-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.proy-name {
  font-size: 1rem;
  font-weight: 700;
}

.proy-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.icon-btn {
  padding: 0.3rem;
  display: inline-flex;
}

.proy-total {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-primary-dark);
}

.proy-progress {
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

.progress-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-2);
  min-width: 2.5rem;
  text-align: right;
}

.proy-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.estado-activo {
  background: rgba(46, 160, 67, 0.15);
  color: #1a7f37;
}

.badge.estado-inactivo {
  background: rgba(110, 118, 129, 0.15);
  color: #6e7781;
}

.badge.estado-suspendido {
  background: rgba(229, 72, 77, 0.15);
  color: #e5484d;
}

.proy-adelanto {
  font-size: 0.85rem;
  color: #6e7781;
  margin-left: auto;
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.grid .full {
  grid-column: 1 / -1;
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
  min-height: 80px;
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
  color: #e5484d;
  padding: 0.3rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
  margin-top: 1.5rem;
  overflow-x: auto;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.tabs button {
  background: transparent;
  color: var(--color-text-2);
  border-radius: 0.25rem 0.25rem 0 0;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 1rem;
  flex-shrink: 0;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.tabs button:hover {
  color: var(--color-text);
  background-color: hsl(var(--primary) / 0.08);
}

.tabs button.active {
  color: var(--color-text);
  border-bottom-color: var(--color-primary);
  font-weight: 700;
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

.socio-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.35rem;
  padding: 0.25rem 0;
  border: 0;
  background: none;
  color: var(--color-text);
  font-size: 0.95rem;
  text-align: left;
  cursor: pointer;
  border-radius: 0.25rem;
}

.socio-item:hover {
  color: var(--color-primary-dark);
}

.socio-icon {
  flex-shrink: 0;
  color: var(--color-text-2);
}

.list .pre {
  white-space: pre-wrap;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

/* Secretos (is_notas con oculto = true) */
.hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-2);
}

.warn-hint {
  color: #9a6700;
  background: rgba(255, 171, 0, 0.14);
  padding: 0.55rem 0.75rem;
  border-radius: 0.35rem;
  font-weight: 600;
}

.sub-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 1rem 0 0.5rem;
  font-size: 0.95rem;
}

.secretos-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px dashed var(--color-border);
  border-radius: 0.35rem;
}

.secreto-input {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.dato-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.secreto-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.secreto-input-row input {
  flex: 1;
}

.secreto-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.secreto-titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.secreto-items {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.secreto-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.secreto-texto {
  font-family: monospace;
  font-size: 0.9rem;
  background: var(--color-background-mute);
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  overflow-wrap: anywhere;
}

.secreto-oculto {
  font-family: monospace;
  letter-spacing: 0.1em;
  color: var(--color-text-2);
}

.reveal-btn {
  padding: 0.25rem 0.55rem;
  font-size: 0.78rem;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem;
  border: 0;
  border-radius: 0.35rem;
  background: hsl(var(--primary) / 0.15);
  color: var(--color-primary-dark);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.edit-btn:hover {
  background: hsl(var(--primary) / 0.3);
  color: var(--color-primary-darker);
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