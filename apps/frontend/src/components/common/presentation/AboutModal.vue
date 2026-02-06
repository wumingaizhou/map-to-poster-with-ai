<script setup lang="ts">
type AboutResourceLink = {
  title: string;
  href: string;
  description?: string;
};

defineProps<{
  isOpen: boolean;
  appName: string;
  version?: string;
  description?: string;
  resources?: AboutResourceLink[];
  features?: string[];
  techStack?: string[];
  repositoryUrl?: string;
  footerNote?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-modal flex items-center justify-center">
        <!-- 遮罩层 -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- 弹窗内容 - 移动端全屏 -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="isOpen"
            class="relative bg-surface rounded-none md:rounded shadow-lg w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] md:mx-4 overflow-hidden flex flex-col safe-area-y"
          >
            <!-- 头部 - 响应式内边距 -->
            <div class="bg-surface px-4 py-4 md:px-6 md:py-5 border-b border-border shrink-0">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 md:gap-4">
                  <div class="w-10 h-10 md:w-11 md:h-11 rounded bg-primary flex items-center justify-center">
                    <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-lg md:text-xl font-medium text-fg tracking-tight">
                      {{ appName }}
                    </h2>
                    <p v-if="version" class="text-muted-subtle text-xs md:text-sm mt-0.5">{{ version }}</p>
                  </div>
                </div>
                <button
                  type="button"
                  @click="emit('close')"
                  class="p-2 md:p-2.5 hover:bg-surface-muted active:bg-surface-subtle rounded transition-colors group touch-target flex items-center justify-center"
                  title="关闭"
                  aria-label="关闭弹窗"
                >
                  <svg
                    class="w-5 h-5 text-muted-subtle group-hover:text-fg transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 内容区域 - 响应式内边距，flex-1 填充剩余空间 -->
            <div class="px-4 py-4 md:px-6 md:py-5 space-y-4 md:space-y-5 flex-1 overflow-y-auto">
              <!-- 描述 -->
              <div v-if="description">
                <p class="text-fg leading-relaxed text-sm md:text-[15px]">{{ description }}</p>
              </div>

              <!-- 灵感 / 数据 / 服务链接 -->
              <div v-if="resources && resources.length > 0">
                <h3 class="text-xs font-medium text-muted-subtle uppercase tracking-wider mb-3">灵感 / 数据 / 服务</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3">
                  <a
                    v-for="(resource, index) in resources"
                    :key="`${resource.href}-${index}`"
                    :href="resource.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group block rounded border border-border bg-surface-muted hover:bg-surface-subtle transition-colors p-3 md:p-3.5"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="w-9 h-9 md:w-10 md:h-10 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"
                      >
                        <svg
                          class="w-4 h-4 md:w-5 md:h-5 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 7h6m0 0v6m0-6L10 20l-3-3 11-10z"
                          />
                        </svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-fg font-medium text-sm md:text-[15px] truncate">
                            {{ resource.title }}
                          </span>
                          <svg
                            class="w-4 h-4 text-muted-subtle group-hover:text-fg transition-colors shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M14 3h7v7m0-7L10 14"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 7v12a2 2 0 002 2h12"
                            />
                          </svg>
                        </div>
                        <p
                          v-if="resource.description"
                          class="text-muted-subtle text-xs md:text-sm mt-1 leading-relaxed"
                        >
                          {{ resource.description }}
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              <!-- 功能列表 -->
              <div v-if="features && features.length > 0">
                <h3 class="text-xs font-medium text-muted-subtle uppercase tracking-wider mb-3">主要功能</h3>
                <ul class="space-y-2 md:space-y-2.5">
                  <li v-for="(feature, index) in features" :key="index" class="flex items-start gap-2 md:gap-3">
                    <div class="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <svg class="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span class="text-fg text-sm md:text-[15px] leading-relaxed">{{ feature }}</span>
                  </li>
                </ul>
              </div>

              <!-- 技术栈 -->
              <div v-if="techStack && techStack.length > 0">
                <h3 class="text-xs font-medium text-muted-subtle uppercase tracking-wider mb-3">技术栈</h3>
                <div class="flex flex-wrap gap-1.5 md:gap-2">
                  <span
                    v-for="(tech, index) in techStack"
                    :key="index"
                    class="px-2.5 py-1 md:px-3 md:py-1 bg-surface-subtle rounded-sm text-xs md:text-sm text-fg"
                  >
                    {{ tech }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 底部 - 响应式内边距 -->
            <div
              class="px-4 py-3 md:px-6 md:py-3 mb-3 bg-surface-muted border-t border-border shrink-0 safe-area-bottom"
            >
              <div class="flex items-center justify-between text-xs md:text-sm text-muted-subtle">
                <span class="truncate">{{ footerNote }}</span>
                <a
                  v-if="repositoryUrl"
                  :href="repositoryUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 md:gap-1.5 hover:text-fg transition-colors shrink-0 ml-2"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                    />
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
