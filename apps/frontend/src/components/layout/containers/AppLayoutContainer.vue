<script setup lang="ts">
// ==================== 展示组件 ====================
import TopBar from "../presentational/TopBar.vue";
import RightPanel from "../presentational/RightPanel.vue";
import MobileTopBar from "../presentational/MobileTopBar.vue";
import MobileDrawer from "../presentational/MobileDrawer.vue";

// ==================== 其他组件 ====================
import AiChatPanelContainer from "@/components/ai-chat/containers/AiChatPanelContainer.vue";
import AboutModalContainer from "@/components/common/containers/AboutModalContainer.vue";
import ErrorBoundary from "@/components/common/atoms/ErrorBoundary.vue";

// ==================== Composables ====================
import { computed, ref } from "vue";
import { useLayoutState } from "@/composables/layout/use-layout-state";
import { useBreakpoints } from "@/composables/layout/use-breakpoints";
import { useScrollLock } from "@/composables/layout/use-scroll-lock";
import { useEscapeKey } from "@/composables/layout/use-escape-key";

const props = withDefaults(
  defineProps<{
    enableRightPanel?: boolean;
    showTopbar?: boolean;
  }>(),
  {
    enableRightPanel: false,
    showTopbar: true
  }
);

// ===== 布局状态管理 =====
const { isRightPanelCollapsed, isMobileRightDrawerOpen, toggleRightPanel, closeMobileDrawers } = useLayoutState();

const { isMobileOrTablet } = useBreakpoints();

// 移动端滚动锁定和 ESC 键处理
const isMobileRightDrawerActive = computed(
  () => props.enableRightPanel && isMobileOrTablet.value && isMobileRightDrawerOpen.value
);
useScrollLock(isMobileRightDrawerActive);
useEscapeKey(isMobileRightDrawerActive, closeMobileDrawers);

// AboutModal 状态
const isAboutModalOpen = ref(false);

function handleOpenAbout() {
  isAboutModalOpen.value = true;
}

function handleCloseAbout() {
  isAboutModalOpen.value = false;
}
</script>

<template>
  <!-- 根容器：h-dvh 解决移动端浏览器地址栏导致的视口高度问题 -->
  <div class="flex flex-col w-full h-dvh bg-bg overflow-hidden">
    <!--
      ========================================
      顶部导航栏区域
      ========================================
    -->

    <!-- [桌面端] 顶部导航栏 -->
    <TopBar
      v-if="props.showTopbar && !isMobileOrTablet"
      :show-chat-toggle="props.enableRightPanel"
      @toggle-right-panel="toggleRightPanel"
      @open-about="handleOpenAbout"
    >
      <template #actions>
        <slot name="topbar-actions" />
      </template>
    </TopBar>

    <!-- [移动端] 顶部导航栏 -->
    <MobileTopBar
      v-else-if="props.showTopbar && isMobileOrTablet"
      :show-chat-toggle="props.enableRightPanel"
      @toggle-chat="toggleRightPanel"
      @open-about="handleOpenAbout"
    >
      <template #actions>
        <slot name="topbar-actions" />
      </template>
    </MobileTopBar>

    <!--
      ========================================
      主要内容区域
      ========================================
      桌面端：主内容区 | RightPanel
      移动端：仅显示主内容区，侧边栏通过抽屉展示
    -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 主内容区域 -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div class="flex-1 w-full h-full relative bg-canvas overflow-auto">
          <slot />
        </div>
      </main>

      <!-- [桌面端] 右侧面板 -->
      <RightPanel v-if="props.enableRightPanel && !isMobileOrTablet" :is-collapsed="isRightPanelCollapsed">
        <slot name="right-panel">
          <ErrorBoundary>
            <AiChatPanelContainer />
          </ErrorBoundary>
        </slot>
      </RightPanel>
    </div>

    <!--
      ========================================
      [移动端] 抽屉式侧边栏
      ========================================
    -->
    <MobileDrawer
      v-if="props.enableRightPanel && isMobileOrTablet"
      :is-open="isMobileRightDrawerOpen"
      position="right"
      title="地图海报设计助手"
      @close="closeMobileDrawers"
    >
      <slot name="right-panel">
        <ErrorBoundary>
          <AiChatPanelContainer />
        </ErrorBoundary>
      </slot>
    </MobileDrawer>
  </div>

  <!-- 关于弹窗 -->
  <ErrorBoundary>
    <AboutModalContainer :is-open="isAboutModalOpen" @close="handleCloseAbout" />
  </ErrorBoundary>
</template>
