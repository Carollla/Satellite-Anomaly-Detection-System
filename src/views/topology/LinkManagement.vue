<template>
  <div class="page-container">
    <h2>链路拓扑</h2>
    <p>这里用于查看星间链路、星地链路、链路质量和转发状态。下一步可接入链路表格、吞吐趋势和绕行操作。</p>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page-container {
  padding: 24px;
  min-height: 100%;
  background: var(--vscode-bg);
  color: var(--vscode-text);
}

p {
  color: var(--vscode-text-muted);
  line-height: 1.7;
}
</style>
