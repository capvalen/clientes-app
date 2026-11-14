<script setup lang="ts">
import { computed } from 'vue'
import { showMontos, montoVisible } from '../utils/montos'
import MontoDots from './MontoDots.vue'

const props = defineProps<{ value?: number | string | null }>()

/** Texto a mostrar cuando los montos están visibles (0 → "Gratis") */
const texto = computed(() => montoVisible(props.value))
</script>

<template>
  <Transition name="monto" mode="out-in">
    <span v-if="showMontos" key="valor" class="monto-val">{{ texto }}</span>
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
