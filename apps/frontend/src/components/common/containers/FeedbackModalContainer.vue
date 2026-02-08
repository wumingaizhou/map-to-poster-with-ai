<script setup lang="ts">
import FeedbackModal from "../presentation/FeedbackModal.vue";
import { ref, toRef } from "vue";
import { useEscapeKey } from "@/composables/layout/use-escape-key";
import { feedbackResource } from "@/services/api-services";
import { toastService, handleError } from "@/shared/error-handler";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const feedbackModalRef = ref<InstanceType<typeof FeedbackModal> | null>(null);
const isSubmitting = ref(false);

function handleClose() {
  emit("close");
}

async function handleSubmit(data: { type: string; content: string; contact: string }) {
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await feedbackResource.submitFeedback(data);
    toastService.success("感谢你的反馈！");
    feedbackModalRef.value?.resetForm();
    handleClose();
  } catch (error) {
    handleError(error);
  } finally {
    isSubmitting.value = false;
  }
}

useEscapeKey(toRef(props, "isOpen"), handleClose);
</script>

<template>
  <FeedbackModal
    ref="feedbackModalRef"
    :is-open="isOpen"
    :is-submitting="isSubmitting"
    @close="handleClose"
    @submit="handleSubmit"
  />
</template>
