<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  IconAlertTriangle,
  IconBuilding,
  IconBuildingBank,
  IconCalendar,
  IconCash,
  IconCheck,
  IconCoin,
  IconDeviceMobile,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconLoader,
  IconNotes,
  IconPhone,
  IconTools,
  IconWallet,
} from '@tabler/icons-vue'
import {
  listPagos,
  listClientes,
  listProyectos,
  listServicios,
  updatePago,
  type Pago,
  type Cliente,
  type Proyecto,
  type Servicio,
  type EntidadTipo,
} from '../api/pocketbase'
import { formatFechaCorta } from '../utils/format'
import { showMontos, monto, toggleMontos } from '../utils/montos'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import Modal from '../components/Modal.vue'
import MetodoPagoPicker from '../components/MetodoPagoPicker.vue'

const loading = ref(true)
const error = ref('')
const saving = ref(false)

const pagos = ref<Pago[]>([])
const clientes = ref<Cliente[]>([])
const proyectos = ref<Proyecto[]>([])
const servicios = ref<Servicio[]>([])

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

// ---- Mapa de entidades (proyecto/servicio) y clientes ----
interface EntidadInfo {
  nombre: string
  tipo: EntidadTipo
  cliente_id: string
  ruta: string
}

const entidades = computed(() => {
  const map = new Map<string, EntidadInfo>()
  for (const p of proyectos.value) {
    map.set(p.id, {
      nombre: p.proyecto,
      tipo: 'proyecto',
      cliente_id: p.cliente_id,
      ruta: `/proyecto/${p.id}`,
    })
  }
  for (const s of servicios.value) {
    map.set(s.id, {
      nombre: s.servicio,
      tipo: 'servicio',
      cliente_id: s.cliente_id,
      ruta: `/servicio/${s.id}`,
    })
  }
  return map
})

const clientesMap = computed(() => {
  const map = new Map<string, Cliente>()
  for (const c of clientes.value) map.set(c.id, c)
  return map
})

function entidadDe(pago: Pago): EntidadInfo | undefined {
  return entidades.value.get(pago.entidad_id)
}

function clienteNombreEntidad(pago: Pago): string {
  const ent = entidadDe(pago)
  if (!ent) return '—'
  return clientesMap.value.get(ent.cliente_id)?.nombre ?? '—'
}

// ---- Agrupación por mes ----
/** Devuelve "YYYY-MM" a partir del string de fecha (parte de fecha, sin zona horaria) */
function ym(value: string | null | undefined): string {
  return String(value ?? '').slice(0, 7)
}

const ahora = new Date()
const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
const siguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
const mesProximo = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, '0')}`

/** Ordena: pendientes primero, y dentro de cada grupo por fecha ascendente */
function ordenar(lista: Pago[]): Pago[] {
  return [...lista].sort((a, b) => {
    const ea = a.estado === 'pendiente' ? 0 : 1
    const eb = b.estado === 'pendiente' ? 0 : 1
    if (ea !== eb) return ea - eb
    return (a.fecha ?? '') < (b.fecha ?? '') ? -1 : 1
  })
}

const cobrosEsteMes = computed(() =>
  ordenar(pagos.value.filter((p) => ym(p.fecha) === mesActual)),
)
const cobrosProximoMes = computed(() =>
  ordenar(pagos.value.filter((p) => ym(p.fecha) === mesProximo)),
)

/** Cobros pendientes de meses ANTERIORES (vencidos / morosos) */
const cobrosVencidos = computed(() =>
  ordenar(pagos.value.filter((p) => p.estado === 'pendiente' && ym(p.fecha) < mesActual)),
)

/** Suma de los montos pendientes (deudas) de una lista */
function totalPendiente(lista: Pago[]): number {
  return lista
    .filter((p) => p.estado === 'pendiente')
    .reduce((acc, p) => acc + (Number(p.monto) || 0), 0)
}

// ---- Realizar pago ----
const target = ref<Pago | null>(null)
const abonoMonto = ref('')
const abonoMetodo = ref('Efectivo')

/** Saldo de la deuda seleccionada (monto - adelanto) */
const saldo = computed(() => {
  const p = target.value
  if (!p) return 0
  return Math.max(0, (Number(p.monto) || 0) - (Number(p.adelanto) || 0))
})

function openRealizarPago(pago: Pago) {
  target.value = pago
  const s = Math.max(0, (Number(pago.monto) || 0) - (Number(pago.adelanto) || 0))
  abonoMonto.value = String(s)
  abonoMetodo.value = pago.metodo_pago || 'Efectivo'
}

function closeRealizarPago() {
  target.value = null
  abonoMonto.value = ''
  abonoMetodo.value = 'Efectivo'
}

async function registrarPago() {
  const pago = target.value
  if (!pago) return
  const abono = Number(abonoMonto.value) || 0
  if (abono <= 0) return
  saving.value = true
  error.value = ''
  try {
    const total = Number(pago.monto) || 0
    const nuevoAdelanto = Math.min(total, (Number(pago.adelanto) || 0) + abono)
    // Si el adelanto cubre el monto, el registro entero pasa a pagado
    const completo = nuevoAdelanto >= total
    const data: Partial<Pago> = {
      adelanto: nuevoAdelanto,
      metodo_pago: abonoMetodo.value,
    }
    if (completo) {
      data.estado = 'pagado'
      data.que_es = 'pago'
    }
    await updatePago(pago.id, data)
    closeRealizarPago()
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al registrar el pago'
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [pgs, cls, proys, servs] = await Promise.all([
      listPagos(),
      listClientes(),
      listProyectos(),
      listServicios(),
    ])
    pagos.value = pgs
    clientes.value = cls
    proyectos.value = proys
    servicios.value = servs
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar los cobros'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main>
    <Breadcrumbs :items="[{ label: 'Cobros' }]" />

    <div class="head">
      <h1><IconWallet :size="26" /> Cobros</h1>
      <button
        class="ghost"
        :title="showMontos ? 'Ocultar montos' : 'Ver montos'"
        @click="toggleMontos"
      >
        <IconEyeOff v-if="showMontos" :size="16" />
        <IconEye v-else :size="16" />
        {{ showMontos ? 'Ocultar montos' : 'Ver montos' }}
      </button>
    </div>

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <p v-else-if="error" class="error">{{ error }}</p>

    <template v-else>
      <p v-if="error" class="error">{{ error }}</p>

      <!-- Cobros vencidos (meses anteriores sin pagar) -->
      <section v-if="cobrosVencidos.length > 0" class="card card-alerta">
        <div class="tab-head">
          <h2 class="alerta-titulo">
            <IconAlertTriangle :size="20" /> Cobros vencidos
          </h2>
          <span class="total-pend alerta-total">
            Por cobrar: {{ monto(totalPendiente(cobrosVencidos)) }}
          </span>
        </div>

        <ul class="list">
          <li v-for="p in cobrosVencidos" :key="p.id" class="cobro">
            <div class="cobro-left">
              <div class="cobro-head">
                <span class="tipo-badge" :class="`tipo-${entidadDe(p)?.tipo ?? 'proyecto'}`">
                  <IconTools v-if="entidadDe(p)?.tipo === 'servicio'" :size="13" />
                  <IconFolder v-else :size="13" />
                  {{ entidadDe(p)?.tipo === 'servicio' ? 'Servicio' : 'Proyecto' }}
                </span>
                <RouterLink v-if="entidadDe(p)" :to="entidadDe(p)!.ruta" class="entidad-link">
                  {{ entidadDe(p)?.nombre }}
                </RouterLink>
              </div>

              <p v-if="p.observaciones" class="cobro-obs">
                <IconNotes :size="13" /> {{ p.observaciones }}
              </p>

              <div class="cobro-sub">
                <span class="cliente">{{ clienteNombreEntidad(p) }}</span>
                <span class="pago-fecha vencida">
                  <IconCalendar :size="13" />
                  {{ formatFechaCorta(p.fecha) }}
                </span>
                <span v-if="p.que_es === 'deuda' && Number(p.adelanto) > 0" class="adelanto">
                  Adelanto: {{ monto(p.adelanto) }}
                </span>
              </div>
            </div>

            <div class="cobro-right">
              <strong class="monto">{{ monto(p.monto) }}</strong>
              <span
                class="badge"
                :style="{ color: pagoInfo(p.estado).color, background: pagoInfo(p.estado).bg }"
              >
                {{ pagoInfo(p.estado).label }}
              </span>
              <button
                v-if="p.estado === 'pendiente'"
                class="realizar-pago"
                type="button"
                @click="openRealizarPago(p)"
              >
                <IconCash :size="16" /> Realizar pago
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Cobros de este mes -->
      <section class="card">
        <div class="tab-head">
          <h2>Cobros de este mes</h2>
          <span class="total-pend">Por cobrar: {{ monto(totalPendiente(cobrosEsteMes)) }}</span>
        </div>

        <p v-if="cobrosEsteMes.length === 0" class="muted">No hay cobros este mes.</p>

        <ul v-else class="list">
          <li v-for="p in cobrosEsteMes" :key="p.id" class="cobro">
            <div class="cobro-left">
              <div class="cobro-head">
                <span class="tipo-badge" :class="`tipo-${entidadDe(p)?.tipo ?? 'proyecto'}`">
                  <IconTools v-if="entidadDe(p)?.tipo === 'servicio'" :size="13" />
                  <IconFolder v-else :size="13" />
                  {{ entidadDe(p)?.tipo === 'servicio' ? 'Servicio' : 'Proyecto' }}
                </span>
                <RouterLink v-if="entidadDe(p)" :to="entidadDe(p)!.ruta" class="entidad-link">
                  {{ entidadDe(p)?.nombre }}
                </RouterLink>
              </div>

              <p v-if="p.observaciones" class="cobro-obs">
                <IconNotes :size="13" /> {{ p.observaciones }}
              </p>

              <div class="cobro-sub">
                <span class="cliente">{{ clienteNombreEntidad(p) }}</span>
                <span class="pago-fecha">
                  <IconCalendar :size="13" />
                  {{ formatFechaCorta(p.fecha) }}
                </span>
                <span v-if="p.que_es === 'deuda' && Number(p.adelanto) > 0" class="adelanto">
                  Adelanto: {{ monto(p.adelanto) }}
                </span>
              </div>
            </div>

            <div class="cobro-right">
              <strong class="monto">{{ monto(p.monto) }}</strong>
              <span
                class="badge"
                :style="{ color: pagoInfo(p.estado).color, background: pagoInfo(p.estado).bg }"
              >
                {{ pagoInfo(p.estado).label }}
              </span>
              <button
                v-if="p.estado === 'pendiente'"
                class="realizar-pago"
                type="button"
                @click="openRealizarPago(p)"
              >
                <IconCash :size="16" /> Realizar pago
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Cobros del próximo mes -->
      <section class="card">
        <div class="tab-head">
          <h2>Del próximo mes</h2>
          <span class="total-pend">Por cobrar: {{ monto(totalPendiente(cobrosProximoMes)) }}</span>
        </div>

        <p v-if="cobrosProximoMes.length === 0" class="muted">No hay cobros el próximo mes.</p>

        <ul v-else class="list">
          <li v-for="p in cobrosProximoMes" :key="p.id" class="cobro">
            <div class="cobro-left">
              <div class="cobro-head">
                <span class="tipo-badge" :class="`tipo-${entidadDe(p)?.tipo ?? 'proyecto'}`">
                  <IconTools v-if="entidadDe(p)?.tipo === 'servicio'" :size="13" />
                  <IconFolder v-else :size="13" />
                  {{ entidadDe(p)?.tipo === 'servicio' ? 'Servicio' : 'Proyecto' }}
                </span>
                <RouterLink v-if="entidadDe(p)" :to="entidadDe(p)!.ruta" class="entidad-link">
                  {{ entidadDe(p)?.nombre }}
                </RouterLink>
              </div>

              <p v-if="p.observaciones" class="cobro-obs">
                <IconNotes :size="13" /> {{ p.observaciones }}
              </p>

              <div class="cobro-sub">
                <span class="cliente">{{ clienteNombreEntidad(p) }}</span>
                <span class="pago-fecha">
                  <IconCalendar :size="13" />
                  {{ formatFechaCorta(p.fecha) }}
                </span>
                <span v-if="p.que_es === 'deuda' && Number(p.adelanto) > 0" class="adelanto">
                  Adelanto: {{ monto(p.adelanto) }}
                </span>
              </div>
            </div>

            <div class="cobro-right">
              <strong class="monto">{{ monto(p.monto) }}</strong>
              <span
                class="badge"
                :style="{ color: pagoInfo(p.estado).color, background: pagoInfo(p.estado).bg }"
              >
                {{ pagoInfo(p.estado).label }}
              </span>
              <button
                v-if="p.estado === 'pendiente'"
                class="realizar-pago"
                type="button"
                @click="openRealizarPago(p)"
              >
                <IconCash :size="16" /> Realizar pago
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <!-- Realizar pago -->
    <Modal v-if="target" title="Realizar pago" size="sm" @close="closeRealizarPago">
      <form class="form" @submit.prevent="registrarPago">
        <dl class="fields resumen">
          <div class="full">
            <dt>Entidad</dt>
            <dd>
              {{ entidadDe(target)?.nombre ?? '—' }}
              <span class="mini">({{ entidadDe(target)?.tipo === 'servicio' ? 'Servicio' : 'Proyecto' }})</span>
            </dd>
          </div>
          <div v-if="target.observaciones" class="full">
            <dt>Detalles</dt>
            <dd>{{ target.observaciones }}</dd>
          </div>
          <div><dt>Total</dt><dd>{{ monto(target.monto) }}</dd></div>
          <div><dt>Abonado</dt><dd class="abonado">{{ monto(target.adelanto) }}</dd></div>
          <div><dt>Pendiente</dt><dd class="restante">{{ monto(saldo) }}</dd></div>
        </dl>

        <div class="grid">
          <label class="full">
            Método de pago
            <MetodoPagoPicker v-model="abonoMetodo" />
          </label>
          <label class="full">
            Monto a pagar (S/) *
            <input
              v-model="abonoMonto"
              type="number"
              min="0"
              :max="saldo"
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
  margin-top: 1rem;
}

.card-alerta {
  border: 1px solid rgba(229, 72, 77, 0.5);
  border-radius: 0.5rem;
  padding: 1.25rem;
  background: rgba(229, 72, 77, 0.06);
}

.alerta-titulo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #e5484d;
}

.alerta-total {
  color: #e5484d;
}

.pago-fecha.vencida {
  color: #e5484d;
  font-weight: 600;
}

.tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.total-pend {
  font-size: 0.85rem;
  font-weight: 600;
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

.cobro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background);
  flex-wrap: wrap;
}

.cobro-left {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  flex: 1 1 220px;
}

.cobro-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.cobro-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-left: auto;
}

.cobro-right .monto {
  font-size: 1.1rem;
  font-weight: 700;
  white-space: nowrap;
}

.entidad-link {
  color: var(--color-text);
  text-decoration: none;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entidad-link:hover {
  color: hsla(160, 100%, 30%, 1);
}

.tipo-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.tipo-badge.tipo-servicio {
  color: #8250df;
  background: #fbefff;
}

.tipo-badge.tipo-proyecto {
  color: #0969da;
  background: #ddf4ff;
}

.cobro-sub {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: var(--color-text-2);
}

.cobro-obs {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-2);
  overflow-wrap: anywhere;
}

.cliente {
  font-weight: 600;
  color: var(--color-text-2);
}

.pago-fecha {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-style: italic;
}

.adelanto {
  color: #0969da;
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

.realizar-pago {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid hsla(160, 100%, 37%, 0.5);
  border-radius: 0.35rem;
  background: transparent;
  color: hsla(160, 100%, 30%, 1);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.realizar-pago:hover {
  background: hsla(160, 100%, 37%, 0.12);
}

/* Formulario / modal */
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

input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
  font-family: inherit;
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

.fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
  margin: 0;
}

.fields.resumen > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.fields dt {
  font-size: 0.82rem;
  color: var(--color-text-2);
}

.fields dd {
  margin: 0;
  text-align: right;
  white-space: pre-wrap;
  word-break: break-word;
}

.fields .full {
  display: block;
}

.fields .full dd {
  text-align: left;
}

.fields .abonado {
  color: #0969da;
}

.fields .restante {
  color: #e5484d;
  font-weight: 700;
}

.mini {
  font-size: 0.75rem;
  color: var(--color-text-2);
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

@media (max-width: 640px) {
  .cobro {
    flex-direction: column;
    align-items: stretch;
  }

  .cobro-right {
    justify-content: flex-start;
    margin-left: 0;
  }
}
</style>
