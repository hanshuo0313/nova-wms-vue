<template>
  <div :class="classObj" class="app-wrapper" :style="{ '--current-color': theme, '--sidebar-width': sidebarWidth + 'px' }">
    <div v-if="device === 'mobile' && sidebar.opened" class="drawer-bg" @click="handleClickOutside"/>
    <sidebar v-if="!sidebar.hide" class="sidebar-container" />
    <!-- 拖拽分隔条 -->
    <div
      v-if="!sidebar.hide && sidebar.opened && device !== 'mobile'"
      class="sidebar-resize-handle"
      @mousedown="startResize"
    >
      <div class="resize-line"></div>
    </div>
    <div :class="{ hasTagsView: needTagsView, sidebarHide: sidebar.hide }" class="main-container">
      <div :class="{ 'fixed-header': fixedHeader }">
        <navbar @setLayout="setLayout" />
        <tags-view v-if="needTagsView" />
      </div>
      <app-main />
      <settings ref="settingRef" />
    </div>
  </div>
</template>

<script setup>
import { useWindowSize } from '@vueuse/core'
import Sidebar from './components/Sidebar/index.vue'
import { AppMain, Navbar, Settings, TagsView } from './components'
import defaultSettings from '@/settings'

import useAppStore from '@/store/modules/app'
import useSettingsStore from '@/store/modules/settings'

const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.theme);
const sideTheme = computed(() => settingsStore.sideTheme);
const sidebar = computed(() => useAppStore().sidebar);
const device = computed(() => useAppStore().device);
const needTagsView = computed(() => settingsStore.tagsView);
const fixedHeader = computed(() => settingsStore.fixedHeader);

// 侧边栏宽度（可拖拽调整）
const MIN_WIDTH = 150;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 200;
const sidebarWidth = ref(parseInt(localStorage.getItem('sidebarWidth')) || DEFAULT_WIDTH);

// 保存宽度到 localStorage
watch(sidebarWidth, (val) => {
  localStorage.setItem('sidebarWidth', val);
});

// 拖拽调整宽度
let isResizing = false;
function startResize(e) {
  isResizing = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  
  const onMouseMove = (event) => {
    if (!isResizing) return;
    let newWidth = event.clientX;
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
    sidebarWidth.value = newWidth;
  };
  
  const onMouseUp = () => {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

const classObj = computed(() => ({
  hideSidebar: !sidebar.value.opened,
  openSidebar: sidebar.value.opened,
  withoutAnimation: sidebar.value.withoutAnimation,
  mobile: device.value === 'mobile'
}))

const { width, height } = useWindowSize();
const WIDTH = 992; // refer to Bootstrap's responsive design

watchEffect(() => {
  if (device.value === 'mobile' && sidebar.value.opened) {
    useAppStore().closeSideBar({ withoutAnimation: false })
  }
  if (width.value - 1 < WIDTH) {
    useAppStore().toggleDevice('mobile')
    useAppStore().closeSideBar({ withoutAnimation: true })
  } else {
    useAppStore().toggleDevice('desktop')
  }
})

function handleClickOutside() {
  useAppStore().closeSideBar({ withoutAnimation: false })
}

const settingRef = ref(null);
function setLayout() {
  settingRef.value.openSetting();
}
</script>

<style lang="scss" scoped>
  @import "@/assets/styles/mixin.scss";
  @import "@/assets/styles/variables.module.scss";

.app-wrapper {
  @include clearfix;
  position: relative;
  height: 100%;
  width: 100%;

  &.mobile.openSidebar {
    position: fixed;
    top: 0;
  }
}

.drawer-bg {
  background: #000;
  opacity: 0.3;
  width: 100%;
  top: 0;
  height: 100%;
  position: absolute;
  z-index: 999;
}

// 拖拽分隔条样式
.sidebar-resize-handle {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 6px;
  left: calc(var(--sidebar-width, 200px) - 3px);
  z-index: 1002;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover .resize-line,
  &:active .resize-line {
    background-color: #409EFF;
    opacity: 1;
  }
  
  .resize-line {
    width: 2px;
    height: 100%;
    background-color: #dcdfe6;
    opacity: 0.5;
    transition: all 0.2s;
  }
}

.fixed-header {
  position: fixed;
  top: 0;
  right: 0;
  left: var(--sidebar-width, 200px);
  z-index: 9;
  width: calc(100% - var(--sidebar-width, 200px));
  transition: width 0.28s, left 0.28s;
}

.hideSidebar .fixed-header {
  left: 54px;
  width: calc(100% - 54px);
}

.sidebarHide .fixed-header {
  width: 100%;
}

.mobile .fixed-header {
  width: 100%;
}
</style>
