<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import type { MarkdownIt } from "markstream-vue";

const MarkdownRender = defineAsyncComponent(async () => {
  await import("markstream-vue/index.css");
  const mod = await import("markstream-vue");
  return mod.default ?? mod;
});

function secureMarkdownIt(md: MarkdownIt): MarkdownIt {
  const mdAny = md as unknown as { set?: (opts: Record<string, unknown>) => void; options?: Record<string, unknown> };

  if (typeof mdAny.set === "function") {
    mdAny.set({ html: false });
  } else if (mdAny.options && typeof mdAny.options === "object") {
    mdAny.options.html = false;
  }

  return md;
}

defineProps<{
  content: string;
  isFinal?: boolean;
}>();
</script>

<template>
  <div class="ai-chat-markdown">
    <MarkdownRender :content="content" :final="isFinal" custom-id="ai-chat" :custom-markdown-it="secureMarkdownIt" />
  </div>
</template>

<style scoped>
.ai-chat-markdown {
  font-size: 13px;
  line-height: 1.5;
}

.ai-chat-markdown :deep(.markstream-vue) {
  font-size: 13px;
}

.ai-chat-markdown :deep(p) {
  font-size: 13px;
  margin: 0.25em 0;
}

.ai-chat-markdown :deep(h1) {
  font-size: 16px;
  margin: 0.5em 0 0.25em;
}

.ai-chat-markdown :deep(h2) {
  font-size: 14px;
  margin: 0.5em 0 0.25em;
}

.ai-chat-markdown :deep(h3) {
  font-size: 13px;
  margin: 0.5em 0 0.25em;
}

.ai-chat-markdown :deep(h4),
.ai-chat-markdown :deep(h5),
.ai-chat-markdown :deep(h6) {
  font-size: 13px;
  margin: 0.5em 0 0.25em;
}

.ai-chat-markdown :deep(ul),
.ai-chat-markdown :deep(ol) {
  font-size: 13px;
  margin: 0.25em 0;
  padding-left: 1.25em;
}

.ai-chat-markdown :deep(li) {
  font-size: 13px;
  margin: 0.125em 0;
}

.ai-chat-markdown :deep(code) {
  font-size: 11px;
}

.ai-chat-markdown :deep(pre) {
  font-size: 11px;
  margin: 0.5em 0;
}

.ai-chat-markdown :deep(blockquote) {
  font-size: 13px;
  margin: 0.5em 0;
  padding: 0.25em 0.5em;
}

/* 表格样式 - 紧凑且不超出容器 */
.ai-chat-markdown :deep(table) {
  font-size: 11px;
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin: 0.5em 0;
  display: block;
  overflow-x: auto;
}

.ai-chat-markdown :deep(thead),
.ai-chat-markdown :deep(tbody),
.ai-chat-markdown :deep(tr) {
  display: table;
  width: 100%;
  table-layout: fixed;
}

.ai-chat-markdown :deep(th),
.ai-chat-markdown :deep(td) {
  font-size: 11px;
  padding: 0.25em 0.5em;
  border: 1px solid var(--border-color, #e5e7eb);
  word-break: break-all;
  overflow-wrap: anywhere;
}

.ai-chat-markdown :deep(th) {
  font-weight: 600;
  background-color: var(--table-header-bg, #f9fafb);
}

.ai-chat-markdown :deep(tr:nth-child(even)) {
  background-color: var(--table-row-alt-bg, #f9fafb);
}
</style>
