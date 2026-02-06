import Panzoom, { type PanzoomObject, type PanzoomOptions } from "@panzoom/panzoom";
import { nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
export interface UsePanzoomOptions {
  minScale?: number;
  maxScale?: number;
  step?: number;
  excludeClass?: string;
}
export interface UsePanzoomReturn {
  canvasEl: Ref<HTMLElement | null>;
  panzoomEl: Ref<HTMLElement | null>;
  panzoom: Ref<PanzoomObject | null>;
  ensurePanzoom: () => Promise<void>;
  resetView: () => void;
  teardown: () => void;
}
export function usePanzoom(options: UsePanzoomOptions = {}): UsePanzoomReturn {
  const { minScale = 0.6, maxScale = 6, step = 0.4, excludeClass = "panzoom-exclude" } = options;
  const canvasEl = ref<HTMLElement | null>(null);
  const panzoomEl = ref<HTMLElement | null>(null);
  const panzoom = ref<PanzoomObject | null>(null);
  let boundCanvasEl: HTMLElement | null = null;
  let boundPanzoomEl: HTMLElement | null = null;
  function computeCenteredStartPosition(): { startX: number; startY: number } | null {
    const canvas = canvasEl.value;
    const target = panzoomEl.value;
    if (!canvas || !target) return null;
    const style = getComputedStyle(canvas);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const innerWidth = canvas.clientWidth - paddingLeft - paddingRight;
    const innerHeight = canvas.clientHeight - paddingTop - paddingBottom;
    if (innerWidth <= 0 || innerHeight <= 0) return null;
    const targetWidth = target.offsetWidth;
    const targetHeight = target.offsetHeight;
    if (!targetWidth || !targetHeight) return null;
    return {
      startX: (innerWidth - targetWidth) / 2,
      startY: (innerHeight - targetHeight) / 2
    };
  }
  function resetView(): void {
    if (!panzoom.value) return;
    const pos = computeCenteredStartPosition();
    if (!pos) return;
    panzoom.value.setOptions({
      startX: pos.startX,
      startY: pos.startY,
      startScale: 1
    });
    panzoom.value.reset({ animate: false });
  }
  function teardown(): void {
    if (boundCanvasEl && panzoom.value) {
      boundCanvasEl.removeEventListener("wheel", panzoom.value.zoomWithWheel);
    }
    panzoom.value?.resetStyle();
    panzoom.value?.destroy();
    panzoom.value = null;
    boundCanvasEl = null;
    boundPanzoomEl = null;
  }
  async function ensurePanzoom(): Promise<void> {
    if (!canvasEl.value || !panzoomEl.value) return;
    if (panzoom.value && boundCanvasEl === canvasEl.value && boundPanzoomEl === panzoomEl.value) return;
    if (panzoom.value) teardown();
    const panzoomOptions: PanzoomOptions = {
      canvas: true,
      excludeClass,
      touchAction: "none",
      panOnlyWhenZoomed: false,
      minScale,
      maxScale,
      step,
      cursor: "grab"
    };
    panzoom.value = Panzoom(panzoomEl.value, panzoomOptions);
    boundCanvasEl = canvasEl.value;
    boundPanzoomEl = panzoomEl.value;
    boundCanvasEl.addEventListener("wheel", panzoom.value.zoomWithWheel, { passive: false });
  }
  onBeforeUnmount(() => {
    teardown();
  });
  return {
    canvasEl,
    panzoomEl,
    panzoom,
    ensurePanzoom,
    resetView,
    teardown
  };
}
export function watchPanzoomInit(
  deps: () => [boolean, HTMLElement | null, HTMLElement | null],
  panzoomReturn: UsePanzoomReturn
): void {
  const { ensurePanzoom, resetView, teardown } = panzoomReturn;
  watch(
    deps,
    async ([ready, nextCanvasEl, nextPanzoomEl]) => {
      if (!ready || !nextCanvasEl || !nextPanzoomEl) {
        teardown();
        return;
      }
      await nextTick();
      await ensurePanzoom();
      resetView();
    },
    { immediate: true }
  );
}
