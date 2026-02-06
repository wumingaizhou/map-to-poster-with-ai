<script setup lang="ts">
import AboutModal from "../presentation/AboutModal.vue";
import { toRef } from "vue";
import { useEscapeKey } from "@/composables/layout/use-escape-key";

const props = defineProps<{
  /** 是否显示弹窗 */
  isOpen: boolean;
}>();

const emit = defineEmits<{
  /** 关闭弹窗 */
  close: [];
}>();

// ===== 应用信息数据 =====
const appInfo = {
  appName: "MapToPosterWithAI",
  version: "v1.0.0",
  description:
    "AI 辅助生成地图海报：输入地名 → 选择专题与主题 → 服务端渲染海报 → 通过对话迭代风格，生成更漂亮的地图海报。",
  resources: [
    {
      title: "灵感来源：maptoposter",
      href: "https://github.com/originalankur/maptoposter",
      description: "在 maptoposter 思路上加入 AI 对话，辅助海报风格迭代与主题调整。"
    },
    {
      title: "数据：OpenStreetMap（OSM）",
      href: "https://www.openstreetmap.org/",
      description: "地图要素数据来源于 OpenStreetMap（© OpenStreetMap contributors）。"
    },
    {
      title: "地名解析：Nominatim",
      href: "https://nominatim.org/",
      description: "用于地名搜索、候选列表与地理编码解析服务。"
    },
    {
      title: "数据获取：Overpass API",
      href: "https://wiki.openstreetmap.org/wiki/Overpass_API",
      description: "用于按 bbox/条件查询并获取 OSM 要素数据。"
    }
  ],
  features: [
    "地名搜索与候选选择（Nominatim）",
    "4 类海报专题：绿地 / 道路 / 建筑 / 水系",
    "主题库（themes-v1）：可选择、可扩展",
    "服务端渲染：OSM 要素 + Theme → SVG → PNG（@resvg/resvg-js）",
    "版本管理：每次生成/迭代产生一个版本（v1/v2/v3…）",
    "AI 设计助手：通过对话调整 palette / tuning / typography，生成新版本",
    "OSM 数据缓存（SQLite）：减少 Overpass 请求与等待时间"
  ],
  techStack: [
    "Vue 3",
    "Vite",
    "TypeScript",
    "TailwindCSS",
    "Naive UI",
    "Node.js",
    "Express",
    "Mastra",
    "@resvg/resvg-js",
    "SQLite"
  ],
  repositoryUrl: "https://github.com/wumingaizhou/map-to-poster-with-ai",
  footerNote: "© OpenStreetMap contributors · License: MIT"
};

// ===== 事件处理 =====
function handleClose() {
  emit("close");
}

useEscapeKey(toRef(props, "isOpen"), handleClose);
</script>

<template>
  <AboutModal
    :is-open="isOpen"
    :app-name="appInfo.appName"
    :version="appInfo.version"
    :description="appInfo.description"
    :resources="appInfo.resources"
    :features="appInfo.features"
    :tech-stack="appInfo.techStack"
    :repository-url="appInfo.repositoryUrl"
    :footer-note="appInfo.footerNote"
    @close="handleClose"
  />
</template>
