<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  IconArrowsSort,
  IconChecklist,
  IconClock,
  IconCoin,
  IconFileInvoice,
  IconMathSymbols,
  IconPlus,
  IconTrash,
} from '@tabler/icons-vue'
import type { PesoCotizador } from '../api/pocketbase'
import { cargarPesosCotizador, getPesosCotizadorLocal } from '../utils/pesosCotizador'

/** Configuración del cotizador (Opciones > Pesos del cotizador) */
const configLocal = getPesosCotizadorLocal()
const pesos = ref<PesoCotizador[]>(configLocal.pesos)
/** Precio por hora global para calcular el costo estimado */
const precioHora = ref<number>(configLocal.precio_hora)
const pesosError = ref('')

onMounted(async () => {
  try {
    // Consulta la BD; si no hay registro, inserta los valores por defecto
    const { config } = await cargarPesosCotizador()
    pesos.value = config.pesos
    precioHora.value = config.precio_hora
    if (!pesos.value.some((p) => p.peso === nuevoPeso.value)) {
      nuevoPeso.value = pesos.value[0]?.peso ?? 1
    }
  } catch (e) {
    // Sin sesión o sin red: se usan los valores guardados en este navegador
    pesosError.value =
      e instanceof Error ? e.message : 'No se pudieron cargar los pesos del servidor'
  }
})

type Actividad = { id: number; nombre: string; peso: number }

/** Actividades registradas por el usuario */
const actividades = ref<Actividad[]>([])

let nextId = 1

const nuevoNombre = ref('')
const nuevoPeso = ref<number>(3)
const error = ref('')

function pesoLabel(valor: number): string {
  return pesos.value.find((p) => p.peso === valor)?.descripcion ?? ''
}

function agregarActividad() {
  const nombre = nuevoNombre.value.trim()
  if (!nombre) {
    error.value = 'Escribe el nombre de la actividad.'
    return
  }
  error.value = ''
  actividades.value.push({ id: nextId++, nombre, peso: nuevoPeso.value })
  // Mantiene el orden actual: por peso si está aplicado, o el original (id)
  if (ordenPeso.value) {
    actividades.value = [...actividades.value].sort((a, b) =>
      ordenPeso.value === 'asc' ? a.peso - b.peso : b.peso - a.peso,
    )
  } else {
    actividades.value = [...actividades.value].sort((a, b) => a.id - b.id)
  }
  nuevoNombre.value = ''
  nuevoPeso.value = pesos.value[0]?.peso ?? 3
}

/** Edición inline del nombre de la actividad (doble clic) */
const editandoId = ref<number | null>(null)
const textoEditado = ref('')
/** Ref dentro de v-for: Vue la expone como arreglo */
const inputEdicion = ref<HTMLInputElement[] | null>(null)

async function iniciarEdicion(actividad: Actividad) {
  // Si ya se está editando esa actividad, no se reinicia el texto
  if (editandoId.value === actividad.id) return
  editandoId.value = actividad.id
  textoEditado.value = actividad.nombre
  await nextTick()
  const input = inputEdicion.value?.[0]
  input?.focus()
  input?.select()
}

/** Enter o pérdida de foco: asigna el texto si no está vacío */
function confirmarEdicion(id: number) {
  if (editandoId.value !== id) return
  const nombre = textoEditado.value.trim()
  const actividad = actividades.value.find((a) => a.id === id)
  if (actividad && nombre) actividad.nombre = nombre
  editandoId.value = null
}

/** Esc: descarta los cambios */
function cancelarEdicion(id: number) {
  if (editandoId.value !== id) return
  editandoId.value = null
}

function eliminarActividad(id: number) {
  actividades.value = actividades.value.filter((a) => a.id !== id)
  if (editandoId.value === id) editandoId.value = null
}

/** Orden actual de la lista por peso: null = sin ordenar, 'asc' = menor a mayor, 'desc' = mayor a menor */
const ordenPeso = ref<'asc' | 'desc' | null>(null)

function ordenarPorPeso() {
  // Ciclo: sin ordenar → ascendente → descendente → sin ordenar (orden original)
  ordenPeso.value = ordenPeso.value === null ? 'asc' : ordenPeso.value === 'asc' ? 'desc' : null

  if (ordenPeso.value === null) {
    // El orden original es el de inserción, equivalente al orden de los id
    actividades.value = [...actividades.value].sort((a, b) => a.id - b.id)
  } else {
    actividades.value = [...actividades.value].sort((a, b) =>
      ordenPeso.value === 'asc' ? a.peso - b.peso : b.peso - a.peso,
    )
  }
}

/** Suma de los pesos de todas las actividades */
const totalPesos = computed(() => actividades.value.reduce((total, a) => total + a.peso, 0))

/** Tiempo estimado: horas del peso × cantidad de actividades con ese peso */
const desglose = computed(() =>
  pesos.value
    .map((p) => {
      const cantidad = actividades.value.filter((a) => a.peso === p.peso).length
      return {
        ...p,
        cantidad,
        /** -1 en horas significa que requiere análisis adicional (no se suma) */
        tiempo: p.horas > 0 ? p.horas * cantidad : 0,
      }
    })
    .filter((p) => p.cantidad > 0),
)

/** Total de horas estimadas de las actividades con tiempo definido */
const tiempoEstimado = computed(() =>
  desglose.value.reduce((total, p) => total + p.tiempo, 0),
)

/** Costo estimado: total de horas × precio_hora, redondeado hacia arriba a 0 decimales */
const costoEstimado = computed(() => Math.ceil(tiempoEstimado.value * precioHora.value))

/** Actividades cuyo peso está marcado como fuera de alcance (-1 horas) */
const actividadesPorAnalizar = computed(
  () => desglose.value.find((p) => p.horas < 0)?.cantidad ?? 0,
)

function formatHoras(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1)
}
</script>

<template>
  <main>
    <div class="head">
      <h1><IconFileInvoice :size="26" /> Cotizador</h1>
    </div>

    <section class="card">
      <h2>Actividades de gestión de software</h2>
      <p class="hint">Registre la actividad y asígnele un peso</p>
      <p v-if="pesosError" class="muted">
        {{ pesosError }} Se usan los pesos guardados en este navegador.
      </p>

      <form class="form-actividad" @submit.prevent="agregarActividad">
        <label class="actividad-nombre">
          Actividad
          <input v-model="nuevoNombre" type="text" placeholder="Ej. Levantamiento de requerimientos" />
        </label>
        <label class="actividad-peso">
          Peso
          <select v-model.number="nuevoPeso">
            <option v-for="p in pesos" :key="p.peso" :value="p.peso">
              {{ p.peso }} · {{ p.descripcion }}
            </option>
          </select>
        </label>
        <button type="submit" class="primary">
          <IconPlus :size="18" /> Agregar
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <p v-if="actividades.length === 0" class="muted">Aún no hay actividades agregadas.</p>

      <div v-else class="list-toolbar">
        <button class="ghost" type="button" @click="ordenarPorPeso">
          <IconArrowsSort :size="18" />
          <template v-if="ordenPeso === 'asc'">Peso: menor a mayor</template>
          <template v-else-if="ordenPeso === 'desc'">Peso: mayor a menor</template>
          <template v-else>Ordenar por peso (orden original)</template>
        </button>
      </div>

      <ul v-if="actividades.length > 0" class="list-actividades">
        <li v-for="actividad in actividades" :key="actividad.id">
          <div class="actividad-texto-wrap" title="Doble clic para editar" @dblclick="iniciarEdicion(actividad)">
            <span v-if="editandoId !== actividad.id" class="actividad-texto editable">{{
              actividad.nombre
            }}</span>
            <input
              v-else
              ref="inputEdicion"
              v-model="textoEditado"
              class="actividad-texto actividad-edit"
              type="text"
              @keydown.enter.prevent="confirmarEdicion(actividad.id)"
              @keydown.esc.prevent="cancelarEdicion(actividad.id)"
              @blur="confirmarEdicion(actividad.id)"
            />
          </div>
          <div class="actividad-acciones">
            <select v-model.number="actividad.peso" class="peso-select" :title="pesoLabel(actividad.peso)">
              <option v-for="p in pesos" :key="p.peso" :value="p.peso">
                {{ p.peso }} · {{ p.descripcion }}
              </option>
            </select>
            <button
              class="danger icon-btn"
              type="button"
              title="Quitar actividad"
              @click="eliminarActividad(actividad.id)"
            >
              <IconTrash :size="16" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Resumen de la sumatoria -->
    <section class="card resumen">
      <h2>Resumen estimado</h2>
      <div class="resumen-grid">
        <!-- Columna 1: totales en cards -->
        <div class="resumen-totales">
          <div class="total">
            <span class="total-label"><IconChecklist :size="16" /> Actividades</span>
            <span class="total-valor">{{ actividades.length }}</span>
          </div>
          <div class="total">
            <span class="total-label"><IconMathSymbols :size="16" /> Suma de pesos</span>
            <span class="total-valor">{{ totalPesos }}</span>
          </div>
          <div class="total">
            <span class="total-label"><IconClock :size="16" /> Tiempo</span>
            <span class="total-valor">{{ formatHoras(tiempoEstimado) }} h</span>
          </div>
          <div class="total">
            <span class="total-label"><IconCoin :size="16" /> Costo</span>
            <span class="total-valor">S/ {{ costoEstimado.toLocaleString('es-PE') }}</span>
          </div>
        </div>

        <!-- Columna 2: pesos usados -->
        <div class="resumen-pesos">
          <template v-if="desglose.length > 0">
            <h3>Pesos usados</h3>
            <ul class="desglose">
              <li v-for="p in desglose" :key="p.peso">
                <span class="chip">{{ p.peso }}</span>
                <span class="desglose-label">{{ p.descripcion }}</span>
                <span class="desglose-cantidad">
                  {{ p.cantidad }} {{ p.cantidad === 1 ? 'actividad' : 'actividades' }}
                  <template v-if="p.horas < 0"> · requiere análisis</template>
                  <template v-else> · {{ formatHoras(p.tiempo) }} h</template>
                </span>
              </li>
            </ul>
            <p v-if="actividadesPorAnalizar > 0" class="muted nota-analisis">
              {{ actividadesPorAnalizar }}
              {{ actividadesPorAnalizar === 1 ? 'actividad requiere' : 'actividades requieren' }}
              análisis adicional y no se incluyen en el tiempo estimado.
            </p>
          </template>
          <p v-else class="muted">Sin actividades para sumar.</p>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.head h1 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.5rem;
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  background: #ffffff;
  margin-top: 1rem;
}

.card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

.card h3 {
  margin: 1rem 0 0.5rem;
  font-size: 0.95rem;
}

.hint {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: var(--color-text-2);
}

.form-actividad {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-actividad label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.actividad-nombre {
  flex: 1 1 260px;
}

.actividad-peso {
  flex: 0 1 220px;
}

input,
select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
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

button.danger {
  background: transparent;
  color: #e5484d;
  padding: 0.3rem;
}

button.ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

button.ghost:hover {
  background: hsl(var(--primary) / 0.1);
  color: var(--color-primary-dark);
}

.list-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
}

.list-actividades {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-actividades li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
}

.actividad-texto-wrap {
  flex: 1;
  min-width: 0;
  padding: 0.3rem 0.25rem;
  margin: -0.3rem -0.25rem;
  border-radius: 0.25rem;
  cursor: text;
}

.actividad-texto {
  min-width: 0;
  overflow-wrap: anywhere;
}

.actividad-texto-wrap:hover {
  background: hsl(var(--primary) / 0.08);
}

.actividad-edit {
  width: 100%;
  padding: 0.3rem 0.5rem;
  font-size: 0.9rem;
}

.actividad-acciones {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 1 auto;
  min-width: 0;
}

.peso-select {
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  min-width: 0;
  max-width: 100%;
}

.actividad-acciones .icon-btn {
  flex-shrink: 0;
}

.resumen-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.resumen-totales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.resumen-pesos h3 {
  margin-top: 0;
}

.total {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 140px;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background-soft);
}

.total-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-text-2);
}

.total-valor {
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.desglose {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.desglose li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.18);
  color: var(--color-primary-dark);
  font-weight: 600;
  font-size: 0.85rem;
}

.desglose-label {
  flex: 1;
}

.desglose-cantidad {
  color: var(--color-text-2);
  font-size: 0.85rem;
}

.error {
  color: #e5484d;
  font-size: 0.85rem;
}

.muted {
  color: var(--color-text-2);
  font-size: 0.85rem;
}

.nota-analisis {
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .resumen-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .list-actividades li {
    flex-direction: column;
    align-items: stretch;
  }

  .actividad-acciones {
    justify-content: flex-end;
    width: 100%;
  }

  .peso-select {
    flex: 1 1 0;
    min-width: 0;
  }
}
</style>
