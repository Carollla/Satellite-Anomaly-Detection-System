<template>
  <div class="page-container">
    <h2>黑板状态</h2>
    <p>这里用于展示 Agent 共享的结构化事实、诊断依据和任务上下文。后续可按 Trace 查询和回放。</p>
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
