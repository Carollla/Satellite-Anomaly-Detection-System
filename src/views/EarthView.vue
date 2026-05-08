<template>
  <div class="earth-view">
    <CesiumViewer :show-all-status="false" class="satmap-bg" />
  </div>
</template>

<script setup lang="ts">
import CesiumViewer from '../components/cesium/CesiumViewer.vue'
</script>

<style scoped>
.earth-view {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.cesium-bg,
.satmap-bg {
  position: absolute;
  inset: 0;
}
</style>
