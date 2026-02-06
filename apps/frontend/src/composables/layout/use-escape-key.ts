import { watch, onUnmounted, type Ref } from "vue";
export function useEscapeKey(isActive: Readonly<Ref<boolean>>, onEscape: () => void) {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isActive.value) {
      onEscape();
    }
  };
  watch(
    isActive,
    active => {
      if (active) {
        document.addEventListener("keydown", handleKeydown);
      } else {
        document.removeEventListener("keydown", handleKeydown);
      }
    },
    { immediate: true }
  );
  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
