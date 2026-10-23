<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { IconPlus, IconLoader, IconFolder, IconUsers, IconSearch, IconEraser, IconTool } from '@tabler/icons-vue'
import {
  listClientes,
  listProyectos,
  listServicios,
  createCliente,
  parseSocios,
  type Cliente,
  type Proyecto,
  type Servicio,
} from '../api/pocketbase'
import Modal from '../components/Modal.vue'

const clientes = ref<Cliente[]>([])
const proyectos = ref<Proyecto[]>([])
const servicios = ref<Servicio[]>([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const creating = ref(false)
const form = ref({ nombre: '', celular: '', ruc: '', direccion: '', email: '' })

// Filtro de búsqueda
const busqueda = ref('')

const clientesFiltrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return clientes.value
  return clientes.value.filter((c) =>
    [c.nombre, c.celular, c.ruc, c.email, c.direccion]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
})

function limpiarBusqueda() {
  busqueda.value = ''
}

const proyectosPorCliente = computed(() => {
  const map = new Map<string, number>()
  for (const p of proyectos.value) {
    map.set(p.cliente_id, (map.get(p.cliente_id) ?? 0) + 1)
  }
  return map
})

function countProyectos(clienteId: string): number {
  return proyectosPorCliente.value.get(clienteId) ?? 0
}

const serviciosPorCliente = computed(() => {
  const map = new Map<string, number>()
  for (const s of servicios.value) {
    map.set(s.cliente_id, (map.get(s.cliente_id) ?? 0) + 1)
  }
  return map
})

function countServicios(clienteId: string): number {
  return serviciosPorCliente.value.get(clienteId) ?? 0
}

function countSocios(cliente: Cliente): number {
  return parseSocios(cliente.socios).length
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [cli, proy, serv] = await Promise.all([listClientes(), listProyectos(), listServicios()])
    clientes.value = cli
    proyectos.value = proy
    servicios.value = serv
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar clientes'
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function crear() {
  if (!form.value.nombre) return
  creating.value = true
  error.value = ''
  try {
    await createCliente(form.value)
    form.value = { nombre: '', celular: '', ruc: '', direccion: '', email: '' }
    showForm.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al crear cliente'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <main>
    <div class="head">
      <h1>Clientes</h1>
      <button class="primary" @click="showForm = true">
        <IconPlus :size="18" />
        Nuevo cliente
      </button>
    </div>

    <div class="search-bar">
      <input
        v-model="busqueda"
        type="text"
        placeholder="Buscar por nombre, celular, RUC, email o dirección…"
        @keyup.enter=""
      />
      <button class="search-btn" title="Buscar" @click="busqueda = busqueda.trim()">
        <IconSearch :size="18" />
      </button>
      <button class="clear-btn" title="Limpiar" @click="limpiarBusqueda">
        <IconEraser :size="18" />
      </button>
    </div>

    <Modal v-if="showForm" title="Nuevo cliente" @close="showForm = false">
      <form class="form" @submit.prevent="crear">
        <div class="grid">
          <label>
            Nombre *
            <input v-model="form.nombre" type="text" required />
          </label>
          <label>
            Celular
            <input v-model="form.celular" type="text" />
          </label>
          <label>
            RUC
            <input v-model="form.ruc" type="text" />
          </label>
          <label>
            Email
            <input v-model="form.email" type="email" />
          </label>
          <label class="full">
            Dirección
            <input v-model="form.direccion" type="text" />
          </label>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="row">
          <button type="submit" class="primary" :disabled="creating">
            <IconLoader v-if="creating" :size="18" class="spin" />
            <IconPlus v-else :size="18" />
            {{ creating ? 'Guardando…' : 'Guardar' }}
          </button>
          <button type="button" class="ghost" @click="showForm = false">Cancelar</button>
        </div>
      </form>
    </Modal>

    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <p v-else-if="clientesFiltrados.length === 0" class="muted">
      {{ busqueda ? 'No hay clientes que coincidan con la búsqueda.' : 'No hay clientes registrados.' }}
    </p>

    <div v-else class="cards">
      <RouterLink
        v-for="cliente in clientesFiltrados"
        :key="cliente.id"
        :to="`/cliente/${cliente.id}`"
        class="card"
      >
        <div class="card-name">{{ cliente.nombre }}</div>
        <div class="card-stats">
          <div class="stats-row">
            <span class="stat">
              <IconFolder :size="16" />
              {{ countProyectos(cliente.id) }} {{ countProyectos(cliente.id) === 1 ? 'proyecto' : 'proyectos' }}
            </span>
            <span class="stat">
              <IconTool :size="16" />
              {{ countServicios(cliente.id) }} {{ countServicios(cliente.id) === 1 ? 'servicio' : 'servicios' }}
            </span>
          </div>
          <span class="stat">
            <IconUsers :size="16" />
            {{ countSocios(cliente) }} {{ countSocios(cliente) === 1 ? 'socio' : 'socios' }}
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

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
}

.search-bar input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
}

.search-bar input:focus {
  outline: none;
  border-color: hsla(160, 100%, 37%, 0.6);
}

.search-btn,
.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.search-btn:hover {
  background: hsla(160, 100%, 37%, 0.15);
  color: hsla(160, 100%, 30%, 1);
}

.clear-btn:hover {
  background: rgba(229, 72, 77, 0.1);
  color: #e5484d;
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

input {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
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
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  color: var(--color-text);
  text-decoration: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.card:hover {
  border-color: hsla(160, 100%, 37%, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: hsla(160, 100%, 30%, 1);
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--color-text-2);
  font-size: 0.85rem;
}

.stats-row {
  display: flex;
  gap: 1rem;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
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