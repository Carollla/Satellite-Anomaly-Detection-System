<template>
  <div class="page-container">
    <h2>故障注入</h2>
    <p>这里用于在仿真环境中注入链路中断、节点离线、资源耗尽等故障，验证 Agent 的检测和恢复能力。</p>
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
