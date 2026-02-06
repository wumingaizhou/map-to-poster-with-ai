import { ref, readonly, computed, type ComputedRef } from "vue";
import { breakpointsConfig } from "@/config";
export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";
const BREAKPOINTS = {
  ...breakpointsConfig
} as const;
const _currentBreakpoint = ref<Breakpoint>("desktop");
const _windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : BREAKPOINTS.desktop);
let _listenerAttached = false;
let _resizeHandler: (() => void) | null = null;
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return "wide";
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}
function updateBreakpoint() {
  if (typeof window === "undefined") return;
  _windowWidth.value = window.innerWidth;
  _currentBreakpoint.value = getBreakpoint(window.innerWidth);
}
function ensureResizeListenerAttached() {
  if (_listenerAttached || typeof window === "undefined") return;
  updateBreakpoint();
  _resizeHandler = updateBreakpoint;
  window.addEventListener("resize", _resizeHandler);
  _listenerAttached = true;
}
export function useBreakpoints() {
  ensureResizeListenerAttached();
  const currentBreakpoint = readonly(_currentBreakpoint);
  const windowWidth = readonly(_windowWidth);
  const isMobile: ComputedRef<boolean> = computed(() => _currentBreakpoint.value === "mobile");
  const isTablet: ComputedRef<boolean> = computed(() => _currentBreakpoint.value === "tablet");
  const isDesktop: ComputedRef<boolean> = computed(
    () => _currentBreakpoint.value === "desktop" || _currentBreakpoint.value === "wide"
  );
  const isWide: ComputedRef<boolean> = computed(() => _currentBreakpoint.value === "wide");
  const isMobileOrTablet: ComputedRef<boolean> = computed(() => isMobile.value || isTablet.value);
  const isAtLeast = (bp: Breakpoint): ComputedRef<boolean> =>
    computed(() => {
      const order: Breakpoint[] = ["mobile", "tablet", "desktop", "wide"];
      return order.indexOf(_currentBreakpoint.value) >= order.indexOf(bp);
    });
  const isAtMost = (bp: Breakpoint): ComputedRef<boolean> =>
    computed(() => {
      const order: Breakpoint[] = ["mobile", "tablet", "desktop", "wide"];
      return order.indexOf(_currentBreakpoint.value) <= order.indexOf(bp);
    });
  return {
    currentBreakpoint,
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isMobileOrTablet,
    isAtLeast,
    isAtMost,
    BREAKPOINTS
  };
}
export function cleanupBreakpoints(): void {
  if (_resizeHandler && typeof window !== "undefined") {
    window.removeEventListener("resize", _resizeHandler);
    _listenerAttached = false;
    _resizeHandler = null;
  }
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupBreakpoints();
  });
}
