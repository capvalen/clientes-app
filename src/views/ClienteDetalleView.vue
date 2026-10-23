<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  IconCheck,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconLoader,
  IconNotebook,
  IconPlus,
  IconTools,
  IconTrash,
  IconUsers,
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
  parseSocios,
  parseNotas,
  type Cliente,
  type Socio,
  type Nota,
  type Proyecto,
  type Servicio,
} from '../api/pocketbase'
import { truncate } from '../utils/format'
import { PERIOCIDAD_LABEL, calcularCuotas, sumarPeriocidad } from '../utils/cuotas'
import { showMontos, monto, toggleMontos } from '../utils/montos'
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
const notas = computed<Nota[]>(() => parseNotas(cliente.value?.notas))

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
  estado: 'activo',
  fecha_inicio: '',
  fecha_final: '',
  observaciones: '',
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
    const [cli, proy, serv] = await Promise.all([getCliente(id), listProyectos(), listServicios()])
    cliente.value = cli
    proyectos.value = proy.filter((p) => p.cliente_id === id)
    servicios.value = serv.filter((s) => s.cliente_id === id)
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
    estado: 'activo',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_final: '',
    observaciones: '',
  }
  // Calcular la fecha final automáticamente
  servicioForm.value.fecha_final = sumarPeriocidad(
    servicioForm.value.fecha_inicio,
    servicioForm.value.periocidad as Servicio['periocidad'],
  )
  showServicioForm.value = true
}

// Si cambia la periocidad, fecha de inicio o total, recalcular la fecha final
watch(
  [() => servicioForm.value.fecha_inicio, () => servicioForm.value.periocidad, () => servicioForm.value.total],
  () => {
    if (servicioForm.value.fecha_inicio) {
      servicioForm.value.fecha_final = sumarPeriocidad(
        servicioForm.value.fecha_inicio,
        servicioForm.value.periocidad as Servicio['periocidad'],
      )
    }
  },
)

async function guardarServicio() {
  if (!cliente.value || !servicioForm.value.servicio) return
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
      fecha_final: servicioForm.value.fecha_final,
      observaciones: servicioForm.value.observaciones,
    })

    // Crear los pagos pendientes entre el período (mismo monto en cada fecha)
    const fechas = calcularCuotas(
      servicio.fecha_inicio,
      servicio.fecha_final,
      servicio.periocidad,
    )
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
    const nota: Nota = { ...notaForm.value }
    cliente.value = await updateCliente(cliente.value.id, { notas: [...notas.value, nota] })
    showNotaForm.value = false
    notaForm.value = { titulo: '', dato: '' }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al guardar nota'
  } finally {
    saving.value = false
  }
}

async function removeNota(index: number) {
  if (!cliente.value) return
  saving.value = true
  error.value = ''
  try {
    const next = notas.value.filter((_, i) => i !== index)
    cliente.value = await updateCliente(cliente.value.id, { notas: next })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar nota'
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
          <IconUsers :size="16" /> Socios
        </button>
        <button :class="{ active: tab === 'notas' }" @click="tab = 'notas'">
          <IconNotebook :size="16" /> Notas
        </button>
        <button :class="{ active: tab === 'proyectos' }" @click="tab = 'proyectos'">
          <IconFolder :size="16" /> Proyectos
        </button>
        <button :class="{ active: tab === 'servicios' }" @click="tab = 'servicios'">
          <IconTools :size="16" /> Servicios
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
        <h2>Notas</h2>
        <button class="primary" @click="showNotaForm = true">
          <IconPlus :size="16" /> Agregar nota
        </button>
      </div>

      <section v-if="tab === 'notas'" class="card">

        <Modal v-if="showNotaForm" title="Nueva nota" @close="showNotaForm = false">
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

        <p v-if="notas.length === 0" class="muted">Sin notas registradas.</p>

        <ul v-else class="list notas">
          <li v-for="(nota, i) in notas" :key="i">
            <div>
              <strong>{{ nota.titulo }}</strong>
              <p v-if="nota.dato" class="pre">{{ nota.dato }}</p>
            </div>
            <button class="danger" title="Eliminar nota" @click="removeNota(i)">
              <IconTrash :size="16" />
            </button>
          </li>
        </ul>
      </section>

      <div v-if="tab === 'proyectos'" class="tab-head">
        <h2>Proyectos</h2>
        <div class="tab-actions">
          <button
            class="ghost"
            :title="showMontos ? 'Ocultar montos' : 'Ver montos'"
            @click="toggleMontos"
          >
            <IconEyeOff v-if="showMontos" :size="16" />
            <IconEye v-else :size="16" />
            {{ showMontos ? 'Ocultar montos' : 'Ver montos' }}
          </button>
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
                  <option value="anual">Anual</option>
                </select>
              </label>
              <label>
                Fecha inicio
                <input v-model="servicioForm.fecha_inicio" type="date" />
              </label>
              <label>
                Fecha final
                <input v-model="servicioForm.fecha_final" type="date" />
              </label>
              <label class="full">
                Observaciones
                <textarea v-model="servicioForm.observaciones" rows="2"></textarea>
              </label>
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
  border-color: hsla(160, 100%, 37%, 0.5);
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
  color: hsla(160, 100%, 30%, 1);
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
  height: 100%;
  border-radius: 999px;
  background: hsla(160, 100%, 37%, 1);
  transition: width 0.3s ease;
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
  background-color: hsla(160, 100%, 37%, 0.08);
}

.tabs button.active {
  color: var(--color-text);
  border-bottom-color: hsla(160, 100%, 37%, 1);
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
  color: hsla(160, 100%, 30%, 1);
}

.list .pre {
  white-space: pre-wrap;
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
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