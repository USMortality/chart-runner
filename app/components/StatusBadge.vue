<script setup lang="ts">
const props = defineProps<{
  status: string;
}>();

const colorMap: Record<string, string> = {
  success: "success",
  failed: "error",
  running: "info",
  pending: "warning",
  cancelled: "neutral",
  never_run: "neutral",
};

const color = computed(() => (colorMap[props.status] || "neutral") as any);
</script>

<template>
  <UBadge :color="color" variant="subtle" size="sm">
    {{ status }}
  </UBadge>
</template>
