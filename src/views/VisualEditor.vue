<template>
  <div class="visual-editor">
    <CesiumViewer :show-all-status="false" :show-float-card="false" class="cesium-bg" />

    <!-- 浮动：打开全部卫星列表按钮 -->
    <el-button 
      class="toggle-btn" 
      type="primary" 
      circle 
      size="large"
      :icon="Operation" 
      @click="showListPanel = !showListPanel" 
      title="菜单 / 卫星列表"
    />

    <!-- 左侧面板：全局卫星列表 -->
    <transition name="fade-panel">
      <div class="editor-panel list-panel" v-if="showListPanel">
        <div class="panel-header">
          <h3>卫星编辑菜单</h3>
          <el-button type="primary" size="small" @click="handleAddNew">新增</el-button>
        </div>

        <el-scrollbar class="sat-list">
          <div 
            v-for="sat in satelliteStore.satellites" 
            :key="sat.id" 
            class="sat-item"
            :class="{ active: satelliteStore.selectedSatelliteId === sat.id }"
            @click="selectSatellite(sat.id)"
          >
            <div class="sat-info">
              <span class="sat-name">{{ sat.name }}</span>
              <el-tag size="small" :type="getStatusType(sat.status)">
                {{ getStatusText(sat.status) }}
              </el-tag>
            </div>
            <div class="sat-actions">
              <el-button type="danger" link size="small" @click.stop="confirmDelete(sat.id)">删除</el-button>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </transition>

    <!-- 右侧面板：选中卫星的详情/编辑卡片 -->
    <transition name="fade-panel">
      <div class="editor-panel detail-panel" v-if="isAdding || satelliteStore.selectedSatellite">
        
        <!-- 编辑模式 -->
        <div class="edit-form" v-if="isAdding || isEditing">
          <h4>{{ isAdding ? '新增自定义卫星' : '编辑卫星参数' }}</h4>
          <el-form :model="formData" label-position="top" size="small">
            <el-form-item label="卫星名称">
              <el-input v-model="formData.name" />
            </el-form-item>
            <el-form-item label="运行状态">
              <el-select v-model="formData.status" class="w-full">
                <el-option label="正常" value="normal" />
                <el-option label="告警" value="warning" />
                <el-option label="严重" value="danger" />
                <el-option label="离线" value="offline" />
              </el-select>
            </el-form-item>
            <el-form-item label="轨道面经度 (Base Longitude)">
              <el-slider v-model="formData.baseLon" :min="-180" :max="180" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="轨道倾角 (Inclination)">
              <el-slider v-model="formData.inclination" :min="-90" :max="90" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="初始相位角 (Phase)">
              <el-slider v-model="formData.phase" :min="0" :max="360" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="轨道高度 (km)">
              <el-slider v-model="displayAlt" :min="100" :max="40000" :step="10" show-input />
            </el-form-item>
            <div class="form-actions">
              <el-button type="warning" plain v-if="!isAdding" @click="restoreSatellite">恢复初始</el-button>
              <el-button @click="cancelEdit">取消</el-button>
              <el-button type="primary" @click="saveEdit">保存并应用</el-button>
            </div>
          </el-form>
        </div>

        <!-- 查看模式 -->
        <div class="view-card" v-else-if="satelliteStore.selectedSatellite">
          <div class="float-card-head">
            <div>
              <strong>{{ satelliteStore.selectedSatellite.name }}</strong>
              <span>{{ satelliteStore.selectedSatellite.instanceId }}</span>
            </div>
            <el-button class="collapse-btn" plain @click="closeDetail">关闭视图</el-button>
          </div>
          <div class="float-card-grid">
            <div class="float-item">
              <label>状态</label>
              <strong class="detail-status" :class="satelliteStore.selectedSatellite.status">
                {{ getStatusText(satelliteStore.selectedSatellite.status) }}
              </strong>
            </div>
            <div class="float-item">
              <label>CPU</label>
              <strong>{{ satelliteStore.selectedSatellite.cpu.toFixed(1) }}%</strong>
            </div>
            <div class="float-item">
              <label>温度</label>
              <strong>{{ satelliteStore.selectedSatellite.temp.toFixed(1) }}°C</strong>
            </div>
            <div class="float-item">
              <label>高度</label>
              <strong>{{ Math.round((satelliteStore.selectedSatellite.alt || 0) / 1000) }} km</strong>
            </div>
          </div>
          <div class="card-footer mt-4">
             <el-button type="primary" class="w-full" @click="isEditing = true">编辑此卫星</el-button>
          </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Operation } from '@element-plus/icons-vue'
import CesiumViewer from '../components/cesium/CesiumViewer.vue'
import { useSatelliteStore } from '../stores/satellite'

const satelliteStore = useSatelliteStore()

const showListPanel = ref(false)
const isAdding = ref(false)
const isEditing = ref(false)

const formData = ref({
  name: '',
  status: 'normal',
  baseLon: 0,
  inclination: 0,
  phase: 0,
  alt: 500000
})

const displayAlt = computed({
  get: () => Math.round(formData.value.alt / 1000),
  set: (val: number) => { formData.value.alt = val * 1000 }
})

// Automatically populate form if a satellite is clicked in the Cesium map or list
watch(() => satelliteStore.selectedSatellite, (newSat) => {
  if (newSat && !isAdding.value) {
    formData.value = {
      name: newSat.name,
      status: newSat.status,
      baseLon: newSat.baseLon || 0,
      inclination: newSat.inclination || 0,
      phase: newSat.phase || 0,
      alt: newSat.alt || 500000
    }
    // We only force view mode if we select a NEW satellite while NOT adding.
    // If user is already editing and clicks a different satellite, it drops to view mode.
    isEditing.value = false
  } else if (!newSat && !isAdding.value) {
    isEditing.value = false
  }
})

function getStatusType(status: string) {
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  if (status === 'offline') return 'info'
  return 'success'
}

function getStatusText(status: string) {
  if (status === 'warning') return '告警'
  if (status === 'danger') return '严重'
  if (status === 'offline') return '离线'
  return '正常'
}

function selectSatellite(id: number) {
  satelliteStore.selectedSatelliteId = id
  isAdding.value = false
  isEditing.value = false
}

function handleAddNew() {
  satelliteStore.selectedSatelliteId = null
  isAdding.value = true
  isEditing.value = false
  formData.value = {
    name: '新建卫星',
    status: 'normal',
    baseLon: 0,
    inclination: 0,
    phase: 0,
    alt: 500000
  }
}

function closeDetail() {
  satelliteStore.selectedSatelliteId = null
  isAdding.value = false
  isEditing.value = false
}

function restoreSatellite() {
  if (satelliteStore.selectedSatellite) {
    ElMessageBox.confirm('确定要恢复为初始轨道配置吗？', '警告', {
      type: 'warning',
      confirmButtonText: '恢复',
      cancelButtonText: '取消'
    }).then(() => {
      satelliteStore.restoreSatellite(satelliteStore.selectedSatelliteId!)
      ElMessage.success('已恢复初始轨道配置')
      isEditing.value = false
    }).catch(() => {})
  }
}

function confirmDelete(id: number) {
  ElMessageBox.confirm('确定要删除这颗卫星吗？', '警告', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  }).then(() => {
    satelliteStore.deleteSatellite(id)
    ElMessage.success('卫星已删除')
  }).catch(() => {})
}

function cancelEdit() {
  if (isAdding.value) {
    isAdding.value = false
  } else {
    isEditing.value = false
  }
}

function saveEdit() {
  if (isAdding.value) {
    satelliteStore.addSatellite({
      name: formData.value.name,
      status: formData.value.status as any,
      baseLon: formData.value.baseLon,
      inclination: formData.value.inclination,
      phase: formData.value.phase,
      alt: formData.value.alt
    })
    ElMessage.success('卫星添加成功')
    isAdding.value = false
  } else if (satelliteStore.selectedSatellite) {
    satelliteStore.updateSatellite(satelliteStore.selectedSatelliteId!, {
      name: formData.value.name,
      status: formData.value.status as any,
      baseLon: formData.value.baseLon,
      inclination: formData.value.inclination,
      phase: formData.value.phase,
      alt: formData.value.alt
    })
    ElMessage.success('参数修改成功，轨道已重新计算')
    isEditing.value = false
  }
}

// Clear selected on exit so we don't interfere with other pages
onUnmounted(() => {
  satelliteStore.selectedSatelliteId = null
})
</script>

<style scoped>
.visual-editor {
  position: relative;
  width: calc(100% + 48px);
  height: calc(100% + 48px);
  margin: -24px;
  overflow: hidden;
}

.cesium-bg {
  position: absolute;
  inset: 0;
}

.toggle-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 15;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.editor-panel {
  position: absolute;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  z-index: 10;
  color: var(--vscode-text);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.list-panel {
  top: 80px;
  left: 24px;
  width: 320px;
  max-height: calc(100% - 104px);
}

.detail-panel {
  top: 24px;
  right: 24px;
  width: 380px;
  max-height: calc(100% - 48px);
}

.panel-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.sat-list {
  flex: 1;
  padding: 12px;
}

.sat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.sat-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sat-item.active {
  border-color: var(--vscode-primary);
  background: rgba(59, 130, 246, 0.1);
}

.sat-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sat-name {
  font-weight: 500;
  color: #e2e8f0;
}

.sat-actions {
  display: flex;
  gap: 8px;
}

.edit-form {
  padding: 20px;
  overflow-y: auto;
}

.edit-form h4 {
  margin: 0 0 20px 0;
  color: #fff;
  font-size: 15px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.w-full {
  width: 100%;
}

/* View Card Styles */
.view-card {
  padding: 20px;
}

.float-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.float-card-head strong {
  color: #f5f9fd;
  display: block;
  font-size: 16px;
  margin-bottom: 4px;
}

.float-card-head span {
  color: #9cb3c7;
  font-size: 13px;
}

.collapse-btn {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #eaf3fb;
}

.float-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.float-item {
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.float-item label,
.float-item strong {
  display: block;
}

.float-item label {
  color: #9cb3c7;
  margin-bottom: 6px;
  font-size: 13px;
}

.float-item strong {
  color: #f5f9fd;
  font-size: 15px;
}

.detail-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.detail-status.normal { color: #8fe388; background: rgba(143, 227, 136, 0.12); }
.detail-status.warning { color: #ffd04b; background: rgba(255, 208, 75, 0.14); }
.detail-status.danger { color: #ff8c8c; background: rgba(255, 107, 107, 0.16); }
.detail-status.offline { color: #b6c2cf; background: rgba(123, 135, 148, 0.18); }

.mt-4 {
  margin-top: 16px;
}

/* Transition styles */
.fade-panel-enter-active,
.fade-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.fade-panel-enter-from,
.fade-panel-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

:deep(.el-form-item__label) {
  color: #cbd5e1 !important;
}
</style>
