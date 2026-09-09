<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { IconPlus, IconTrash, IconLoader } from '@tabler/icons-vue'
import { listClientes, createCliente, deleteCliente, type Cliente } from '../api/pocketbase'
import Modal from '../components/Modal.vue'

const clientes = ref<Cliente[]>([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const creating = ref(false)
const form = ref({ nombre: '', celular: '', ruc: '', direccion: '', email: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    clientes.value = await listClientes()
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

async function eliminar(cliente: Cliente) {
  if (!confirm(`¿Eliminar a "${cliente.nombre}"?`)) return
  error.value = ''
  try {
    await deleteCliente(cliente.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al eliminar cliente'
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

    <p v-else-if="clientes.length === 0" class="muted">No hay clientes registrados.</p>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Celular</th>
          <th>RUC</th>
          <th>Email</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cliente in clientes" :key="cliente.id">
          <td>
            <RouterLink :to="`/cliente/${cliente.id}`">{{ cliente.nombre }}</RouterLink>
          </td>
          <td>{{ cliente.celular }}</td>
          <td>{{ cliente.ruc }}</td>
          <td>{{ cliente.email }}</td>
          <td class="actions">
            <button class="danger" title="Eliminar" @click="eliminar(cliente)">
              <IconTrash :size="16" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.actions {
  text-align: right;
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