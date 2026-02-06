<script setup lang="ts">
import { onMounted } from "vue";
import { useMessage } from "naive-ui";
import { toastService } from "@/shared/error-handler";

onMounted(() => {
  const message = useMessage();
  toastService.init(message);
});
</script>

<template>
  <router-view v-slot="{ Component }">
    <Transition name="page-fade" mode="out-in">
      <component :is="Component" :key="$route.path" />
    </Transition>
  </router-view>
</template>
