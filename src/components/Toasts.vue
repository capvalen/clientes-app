<script setup lang="ts">
import { IconCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-vue'
import { toasts } from '../utils/toast'
</script>

<template>
  <Teleport to="body">
    <div class="toasts" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
          <IconCheck v-if="t.type === 'success'" :size="16" />
          <IconAlertCircle v-else-if="t.type === 'error'" :size="16" />
          <IconInfoCircle v-else :size="16" />
          <span>{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toasts {
  position: fixed;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  pointer-events: none;
}

.toast {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  pointer-events: auto;
}

.toast-success {
  background: #1a7f37;
}

.toast-error {
  background: #e5484d;
}

.toast-info {
  background: #0969da;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
