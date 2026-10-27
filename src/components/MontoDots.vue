<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Diámetro de cada bolita en px */
    size?: number
  }>(),
  { size: 6 },
)
</script>

<template>
  <span class="monto-dots" aria-label="Monto oculto" title="Monto oculto">
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px` }"></span>
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px` }"></span>
    <span class="dot" :style="{ width: `${size}px`, height: `${size}px` }"></span>
  </span>
</template>

<style scoped>
.monto-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  vertical-align: middle;
  line-height: 1;
}

.dot {
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
</style>
