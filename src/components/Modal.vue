<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { IconX } from '@tabler/icons-vue'

defineProps<{ title: string; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div class="modal" :class="size === 'sm' ? 'modal-sm' : ''" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2>{{ title }}</h2>
          <button class="close" type="button" @click="emit('close')" aria-label="Cerrar">
            <IconX :size="18" />
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
}

.modal {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-sm {
  max-width: 400px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 0;
}

.modal-head h2 {
  font-size: 1.1rem;
  margin: 0;
}

.close {
  background: none;
  border: 0;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  display: inline-flex;
}

.close:hover {
  background: var(--color-background-mute);
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}
</style>