import { defineStore } from "pinia";
import { ref, computed } from "vue";
export const useLayoutStore = defineStore("layout", () => {
  const isRightPanelCollapsed = ref(false);
  const isMobileRightDrawerOpen = ref(false);
  const isAnyDrawerOpen = computed(() => isMobileRightDrawerOpen.value);
  function setRightPanelCollapsed(collapsed: boolean): void {
    isRightPanelCollapsed.value = collapsed;
  }
  function toggleRightPanelCollapsed(): void {
    isRightPanelCollapsed.value = !isRightPanelCollapsed.value;
  }
  function openMobileRightDrawer(): void {
    isMobileRightDrawerOpen.value = true;
  }
  function closeMobileRightDrawer(): void {
    isMobileRightDrawerOpen.value = false;
  }
  function toggleMobileRightDrawer(): void {
    isMobileRightDrawerOpen.value = !isMobileRightDrawerOpen.value;
  }
  function closeMobileDrawers(): void {
    isMobileRightDrawerOpen.value = false;
  }
  function resetLayout(): void {
    isRightPanelCollapsed.value = false;
    isMobileRightDrawerOpen.value = false;
  }
  return {
    isRightPanelCollapsed,
    isMobileRightDrawerOpen,
    isAnyDrawerOpen,
    setRightPanelCollapsed,
    toggleRightPanelCollapsed,
    openMobileRightDrawer,
    closeMobileRightDrawer,
    toggleMobileRightDrawer,
    closeMobileDrawers,
    resetLayout
  };
});
