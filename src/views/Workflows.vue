<template>
  <div class="page-container">
    <h2>执行流图</h2>
    <p>这里用于编排异常诊断、审批、处置和复核流程。后续可展示 DAG 节点、执行进度和失败重试。</p>
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
