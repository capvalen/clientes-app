<script setup lang="ts">
import { ref } from 'vue'
import { IconUpload, IconFile, IconX } from '@tabler/icons-vue'

withDefaults(
  defineProps<{
    accept?: string
    /** Archivos ya adjuntos en el servidor (solo lectura, se muestran como referencia) */
    existing?: { name: string; url: string }[]
  }>(),
  {
    accept: '.pdf,image/*',
    existing: () => [],
  },
)

/** Emite la lista completa de archivos nuevos seleccionados */
const emit = defineEmits<{ change: [files: File[]] }>()

const inputEl = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const dragging = ref(false)

/** Añade archivos a la lista (se acumulan de 1 en 1) */
function addFiles(list: FileList | File[] | null | undefined) {
  if (!list) return
  const arr = Array.from(list)
  if (arr.length === 0) return
  files.value = [...files.value, ...arr]
  emit('change', [...files.value])
}

/** Abre el selector de archivos con un solo clic */
function pick() {
  inputEl.value?.click()
}

function onInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles(input.files)
  // Permite volver a seleccionar el mismo archivo más adelante
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  addFiles(e.dataTransfer?.files)
}

function removeAt(index: number) {
  files.value = files.value.filter((_, i) => i !== index)
  emit('change', [...files.value])
}
</script>

<template>
  <div>
    <!-- Input nativo oculto (múltiple): se dispara con un solo clic -->
    <input
      ref="inputEl"
      class="hidden-input"
      type="file"
      multiple
      :accept="accept"
      @change="onInputChange"
    />

    <ul v-if="existing.length || files.length" class="file-list">
      <!-- Adjuntos ya guardados en el servidor -->
      <li v-for="f in existing" :key="`srv-${f.name}`" class="file-chip server">
        <IconFile :size="18" />
        <a class="name" :href="f.url" target="_blank" rel="noopener">{{ f.name }}</a>
        <span class="tag">Adjunto</span>
      </li>

      <!-- Archivos nuevos (aún sin guardar) -->
      <li v-for="(f, i) in files" :key="`new-${i}-${f.name}`" class="file-chip">
        <IconFile :size="18" />
        <span class="name">{{ f.name }}</span>
        <button type="button" class="remove" title="Quitar archivo" @click="removeAt(i)">
          <IconX :size="16" />
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="dropzone-zone"
      :class="{ 'dz-drag-hover': dragging }"
      @click="pick"
      @dragover.prevent="dragging = true"
      @dragenter.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <IconUpload :size="28" />
      <span class="text">
        {{
          files.length || existing.length
            ? 'Agregar más comprobantes'
            : 'Arrastra los comprobantes aquí o haz clic para adjuntar'
        }}
      </span>
      <span class="hint">PDF o imagen · puedes adjuntar varios</span>
    </button>
  </div>
</template>

<style scoped>
.hidden-input {
  display: none;
}

.file-list {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.dropzone-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  font: inherit;
  line-height: inherit;
  border: 2px dashed var(--color-border);
  border-radius: 0.5rem;
  padding: 1.5rem 1rem;
  text-align: center;
  cursor: pointer;
  color: var(--color-text-2);
  background: var(--color-background);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.dropzone-zone:hover,
.dropzone-zone.dz-drag-hover {
  border-color: hsl(var(--primary) / 0.6);
  background: hsl(var(--primary) / 0.06);
  color: var(--color-primary-dark);
}

.dropzone-zone .text {
  font-size: 0.9rem;
}

.dropzone-zone .hint {
  font-size: 0.75rem;
  opacity: 0.8;
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background-soft);
  color: var(--color-text);
}

.file-chip .name {
  flex: 1;
  font-size: 0.85rem;
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip.server .name {
  color: var(--color-primary-dark);
}

.file-chip.server .name:hover {
  text-decoration: underline;
}

.file-chip .tag {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6e7781;
  background: #eaeef2;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.file-chip .remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.2rem;
  border: 0;
  border-radius: 0.25rem;
  background: none;
  color: #e5484d;
  cursor: pointer;
}

.file-chip .remove:hover {
  background: rgba(229, 72, 77, 0.1);
}
</style>