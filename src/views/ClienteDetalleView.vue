<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  IconArrowLeft,
  IconCheck,
  IconEdit,
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
  parseSocios,
  parseNotas,
  type Cliente,
  type Socio,
  type Nota,
} from '../api/pocketbase'
import Modal from '../components/Modal.vue'

const route = useRoute()
const id = route.params.id as string

const cliente = ref<Cliente | null>(null)
const loading = ref(true)
const error = ref('')
const saving = ref(false)

type Tab = 'socios' | 'notas' | 'proyectos' | 'servicios'
const tab = ref<Tab>('socios')

const socios = computed<Socio[]>(() => parseSocios(cliente.value?.socios))
const notas = computed<Nota[]>(() => parseNotas(cliente.value?.notas))

// Edición de datos generales
const editing = ref(false)
const editForm = ref({ nombre: '', celular: '', ruc: '', direccion: '', email: '' })

// Formularios de sub-registros
const showSocioForm = ref(false)
const socioForm = ref({ nombre: '', celular: '', cargo: '', ubicacion: '' })
const showNotaForm = ref(false)
const notaForm = ref({ titulo: '', dato: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    cliente.value = await getCliente(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el cliente'
  } finally {
    loading.value = false
  }
}

onMounted(load)

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
    <p><RouterLink to="/cliente"><IconArrowLeft :size="16" /> Volver a clientes</RouterLink></p>

    <p v-if="loading" class="muted"><IconLoader :size="16" class="spin" /> Cargando…</p>

    <template v-else-if="cliente">
      <div class="head">
        <h1>{{ cliente.nombre }}</h1>
        <button v-if="!editing" class="primary" @click="startEdit">
          <IconEdit :size="18" /> Editar
        </button>
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
      <section v-if="tab === 'socios'" class="card">
        <div class="tab-head">
          <h2>Socios</h2>
          <button class="primary" @click="showSocioForm = true">
            <IconPlus :size="16" /> Agregar socio
          </button>
        </div>

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
            <div>
              <strong>{{ socio.nombre }}</strong>
              <span v-if="socio.cargo"> · {{ socio.cargo }}</span>
              <span v-if="socio.celular"> · {{ socio.celular }}</span>
              <span v-if="socio.ubicacion"> · {{ socio.ubicacion }}</span>
            </div>
            <button class="danger" title="Eliminar socio" @click="removeSocio(i)">
              <IconTrash :size="16" />
            </button>
          </li>
        </ul>
      </section>

      <!-- Notas -->
      <section v-else-if="tab === 'notas'" class="card">
        <div class="tab-head">
          <h2>Notas</h2>
          <button class="primary" @click="showNotaForm = true">
            <IconPlus :size="16" /> Agregar nota
          </button>
        </div>

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

      <!-- Proyectos / Servicios: pendientes de especificar -->
      <section v-else class="card">
        <h2>{{ tab === 'proyectos' ? 'Proyectos' : 'Servicios' }}</h2>
        <p class="muted">Esta pestaña aún no está configurada.</p>
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
  margin-bottom: 1rem;
}

.tab-head h2 {
  margin: 0;
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
}

.tabs button {
  background: transparent;
  color: var(--color-text-2);
  border-radius: 0.25rem 0.25rem 0 0;
  border-bottom: 2px solid transparent;
  padding: 0.6rem 1rem;
}

.tabs button.active {
  color: var(--color-text);
  border-bottom-color: hsla(160, 100%, 37%, 1);
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