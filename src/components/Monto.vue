<script setup lang="ts">
import { showMontos } from '../utils/montos'
import MontoDots from './MontoDots.vue'

defineProps<{ value?: number | string | null }>()
</script>

<template>
  <Transition name="monto" mode="out-in">
    <span v-if="showMontos" key="valor" class="monto-val">
      S/ {{ Number(value || 0).toFixed(2) }}
    </span>
    <MontoDots v-else key="dots" />
  </Transition>
</template>

<style scoped>
.monto-val {
  white-space: nowrap;
}

/* Transición sutil entre las bolitas y el monto real */
.monto-enter-active,
.monto-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.monto-enter-from {
  opacity: 0;
  transform: translateY(3px) scale(0.96);
}

.monto-leave-to {
  opacity: 0;
  transform: translateY(-2px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .monto-enter-active,
  .monto-leave-active {
    transition: none;
  }
}
</style>
