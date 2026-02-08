<script setup lang="ts">
import { ref, nextTick, onUnmounted } from "vue";

withDefaults(
  defineProps<{
    size?: "sm" | "md";
  }>(),
  {
    size: "md"
  }
);

const emit = defineEmits<{
  select: [key: string];
}>();

const menuItems = [
  { key: "faq", label: "常见问题" },
  { key: "feedback", label: "意见反馈" },
  { key: "about", label: "关于" }
];

const isOpen = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref<Record<string, string>>({});

function updateDropdownPosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    top: `${rect.bottom + 6}px`,
    right: `${window.innerWidth - rect.right}px`
  };
}

async function toggle() {
  if (isOpen.value) {
    isOpen.value = false;
  } else {
    updateDropdownPosition();
    await nextTick();
    isOpen.value = true;
  }
}

function close() {
  isOpen.value = false;
}

function handleSelect(key: string) {
  close();
  emit("select", key);
}

// ===== 键盘支持 =====
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isOpen.value) {
    close();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", handleKeydown);
}

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.removeEventListener("keydown", handleKeydown);
  }
});
</script>

<template>
  <!-- 触发按钮 -->
  <button
    ref="triggerRef"
    type="button"
    @click="toggle"
    class="rounded transition-colors flex items-center justify-center"
    :class="
      size === 'sm'
        ? 'p-2 hover:bg-surface-muted active:bg-surface-subtle touch-target'
        : 'p-2 hover:bg-primary-subtle focus-visible-ring'
    "
    title="更多选项"
    aria-label="打开菜单"
    :aria-expanded="isOpen"
    aria-haspopup="menu"
  >
    <svg
      class="w-5 h-5"
      :class="size === 'sm' ? 'text-muted-subtle' : 'text-muted hover:text-primary'"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  </button>

  <!-- 下拉菜单（Teleport 到 body，避免 overflow 裁剪） -->
  <Teleport to="body">
    <template v-if="isOpen">
      <!-- 透明遮罩：捕获外部点击以关闭菜单 -->
      <div class="fixed inset-0 z-overlay" @click="close" />

      <!-- 菜单面板 -->
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          class="fixed z-popover bg-surface border border-border rounded-lg shadow-lg py-1 min-w-40 origin-top-right"
          :style="dropdownStyle"
          role="menu"
        >
          <button
            v-for="item in menuItems"
            :key="item.key"
            type="button"
            role="menuitem"
            @click="handleSelect(item.key)"
            class="w-full px-3.5 py-2.5 text-left text-sm text-fg hover:bg-surface-muted active:bg-surface-subtle transition-colors flex items-center gap-2.5"
          >
            <!-- 常见问题图标 -->
            <svg
              v-if="item.key === 'faq'"
              class="w-4 h-4 text-muted-subtle shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <!-- 意见反馈图标 -->
            <svg
              v-else-if="item.key === 'feedback'"
              class="w-4 h-4 text-muted-subtle shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            <!-- 关于图标 -->
            <svg
              v-else-if="item.key === 'about'"
              class="w-4 h-4 text-muted-subtle shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </Transition>
    </template>
  </Teleport>
</template>
