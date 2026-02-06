import { readonly, computed, watch, onScopeDispose, type DeepReadonly, type Ref, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useLayoutStore } from "@/stores/layout/layout-store";
import { useBreakpoints } from "./use-breakpoints";
export function useLayoutState() {
  const layoutStore = useLayoutStore();
  const { isMobileOrTablet } = useBreakpoints();
  const { isRightPanelCollapsed, isMobileRightDrawerOpen, isAnyDrawerOpen } = storeToRefs(layoutStore);
  const stopAutoCloseDrawers = watch(isMobileOrTablet, isMobileNow => {
    if (!isMobileNow) {
      layoutStore.closeMobileDrawers();
    }
  });
  onScopeDispose(() => {
    stopAutoCloseDrawers();
  });
  const readonlyIsRightPanelCollapsed: DeepReadonly<Ref<boolean>> = readonly(isRightPanelCollapsed);
  const readonlyIsMobileRightDrawerOpen: DeepReadonly<Ref<boolean>> = readonly(isMobileRightDrawerOpen);
  const showRightPanel: ComputedRef<boolean> = computed(() => {
    if (isMobileOrTablet.value) {
      return isMobileRightDrawerOpen.value;
    }
    return !isRightPanelCollapsed.value;
  });
  function toggleRightPanel(): void {
    if (isMobileOrTablet.value) {
      layoutStore.toggleMobileRightDrawer();
    } else {
      layoutStore.toggleRightPanelCollapsed();
    }
  }
  function setRightPanelCollapsed(collapsed: boolean): void {
    layoutStore.setRightPanelCollapsed(collapsed);
  }
  function closeMobileDrawers(): void {
    layoutStore.closeMobileDrawers();
  }
  function openMobileRightDrawer(): void {
    layoutStore.openMobileRightDrawer();
  }
  function resetLayout(): void {
    layoutStore.resetLayout();
  }
  return {
    isRightPanelCollapsed: readonlyIsRightPanelCollapsed,
    isMobileRightDrawerOpen: readonlyIsMobileRightDrawerOpen,
    showRightPanel,
    isAnyDrawerOpen,
    toggleRightPanel,
    setRightPanelCollapsed,
    closeMobileDrawers,
    openMobileRightDrawer,
    resetLayout
  };
}
