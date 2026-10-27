<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { IconX } from '@tabler/icons-vue'

defineProps<{ title: string; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ close: [] }>()

// Animación de salida antes de avisar al padre para desmontar el modal
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined

function requestClose() {
  if (closing.value) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    emit('close')
    return
  }
  closing.value = true
  closeTimer = setTimeout(() => emit('close'), 160)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') requestClose()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(closeTimer)
})
</script>

<template>
  <Teleport to="body">
    <div class="overlay" :class="{ closing }" @click.self="requestClose">
      <div class="modal" :class="size === 'sm' ? 'modal-sm' : ''" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2>{{ title }}</h2>
          <button class="close" type="button" @click="requestClose" aria-label="Cerrar">
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
  animation: overlay-in 180ms ease-out both;
}

.overlay.closing {
  animation: overlay-out 160ms ease-in both;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes overlay-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
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
  animation: modal-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.overlay.closing .modal {
  animation: modal-out 160ms ease-in both;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes modal-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overlay,
  .overlay.closing,
  .modal,
  .overlay.closing .modal {
    animation: none;
  }
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