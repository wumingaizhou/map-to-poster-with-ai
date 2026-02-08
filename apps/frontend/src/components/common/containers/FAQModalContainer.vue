<script setup lang="ts">
import FAQModal from "../presentation/FAQModal.vue";
import type { FAQItem } from "../presentation/FAQModal.vue";
import { toRef } from "vue";
import { useEscapeKey } from "@/composables/layout/use-escape-key";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const faqItems: FAQItem[] = [
  {
    question: "为什么有的大城市数据不全？",
    answer: "每个类别（例如建筑物）最大数量限制为50000个（优化用户体验），如需获取更多数据，请本地部署运行。"
  },
  {
    question: "为什么有些地点没有数据？",
    answer: "数据来源于 OpenStreetMap，小尺度范围的地点数据可能较少，甚至没有。建议尝试更大范围或选择知名地点。"
  },
  {
    question: "为什么有些大城市首版海报生成速度较慢，有些大城市生成较快？",
    answer:
      "1.说明命中缓存了。2.有其他人正在使用，土豆服务器资源有限，请稍等片刻再试。3.该城市数据量较大，生成时间相应增加。"
  },
  {
    question: "为什么生成的海报很模糊？",
    answer: "画布渲染的图片是压缩后的（优化用户体验），下载的图片是正常的。"
  },
  {
    question: "地图数据来自哪里？",
    answer:
      "地图数据来源于 OpenStreetMap（OSM），通过 Overpass API 获取。地名解析使用 Nominatim 服务。所有数据遵循 OSM 开放数据协议。"
  }
];

function handleClose() {
  emit("close");
}

useEscapeKey(toRef(props, "isOpen"), handleClose);
</script>

<template>
  <FAQModal :is-open="isOpen" :items="faqItems" @close="handleClose" />
</template>
