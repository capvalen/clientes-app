<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Dropzone from 'dropzone'
import { IconUpload, IconFile, IconX } from '@tabler/icons-vue'

const props = withDefaults(defineProps<{ accept?: string }>(), {
  accept: '.pdf,image/*',
})

const emit = defineEmits<{ change: [file: File | null] }>()

const zoneEl = ref<HTMLDivElement | null>(null)
const file = ref<File | null>(null)
let dz: Dropzone | null = null

onMounted(() => {
  if (!zoneEl.value) return
  Dropzone.autoDiscover = false
  dz = new Dropzone(zoneEl.value, {
    url: '/upload', // no se usa: el archivo se sube con el FormData al guardar
    autoProcessQueue: false,
    maxFiles: 1,
    acceptedFiles: props.accept,
    previewsContainer: false,
    clickable: true,
  })
  dz.on('addedfile', (f) => {
    file.value = f as File
    emit('change', f as File)
  })
  dz.on('removedfile', () => {
    file.value = null
    emit('change', null)
  })
  dz.on('maxfilesexceeded', (f) => {
    dz?.removeFile(f)
  })
})

onUnmounted(() => {
  dz?.destroy()
  dz = null
})

function remove() {
  dz?.removeAllFiles()
}
</script>

<template>
  <div>
    <div ref="zoneEl" v-show="!file" class="dropzone-zone">
      <IconUpload :size="28" />
      <p>Arrastra el comprobante aquí o haz clic para adjuntar</p>
      <span class="hint">PDF o imagen</span>
    </div>

    <div v-if="file" class="file-chip">
      <IconFile :size="18" />
      <span class="name">{{ file.name }}</span>
      <button type="button" class="remove" title="Quitar archivo" @click="remove">
        <IconX :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.dropzone-zone {
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
  border-color: hsla(160, 100%, 37%, 0.6);
  background: hsla(160, 100%, 37%, 0.06);
  color: hsla(160, 100%, 30%, 1);
}

.dropzone-zone p {
  margin: 0.5rem 0 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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