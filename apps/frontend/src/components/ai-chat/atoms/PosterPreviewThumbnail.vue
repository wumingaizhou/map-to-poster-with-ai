<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { posterAlphaService } from "@/services/api-services";
import { acquirePosterPreviewObjectUrl, setPosterPreviewObjectUrlSize } from "@/utils/poster-preview-object-url-cache";

const props = defineProps<{
  versionId: string;
}>();

type LoadState = "loading" | "ready" | "error";

const state = ref<LoadState>("loading");
const objectUrl = ref<string | null>(null);
const naturalWidth = ref<number>(0);
const naturalHeight = ref<number>(0);
const errorMessage = ref<string | null>(null);
const loadedVersionId = ref<string | null>(null);

const thumbEl = ref<HTMLElement | null>(null);
const imgEl = ref<HTMLImageElement | null>(null);

let currentRelease: (() => void) | null = null;
let loadSeq = 0;

function cleanup(): void {
  if (currentRelease) {
    currentRelease();
    currentRelease = null;
  }
  objectUrl.value = null;
  naturalWidth.value = 0;
  naturalHeight.value = 0;
  loadedVersionId.value = null;
}

async function loadPreview(): Promise<void> {
  const seq = (loadSeq += 1);

  cleanup();
  state.value = "loading";
  errorMessage.value = null;

  try {
    const result = await acquirePosterPreviewObjectUrl(props.versionId, async () => {
      const { blob } = await posterAlphaService.downloadPngBlob(props.versionId);
      return blob;
    });

    if (seq !== loadSeq) {
      result.release();
      return;
    }

    currentRelease = result.release;
    objectUrl.value = result.url;
    naturalWidth.value = result.width;
    naturalHeight.value = result.height;
    loadedVersionId.value = props.versionId;
    state.value = "ready";
  } catch (error) {
    if (seq !== loadSeq) return;
    state.value = "error";
    errorMessage.value = error instanceof Error ? error.message : "预览加载失败";
  }
}

function handleImgLoad(): void {
  if (!imgEl.value) return;
  if (loadedVersionId.value !== props.versionId) return;

  const w = imgEl.value.naturalWidth;
  const h = imgEl.value.naturalHeight;
  if (!w || !h) return;

  naturalWidth.value = w;
  naturalHeight.value = h;
  setPosterPreviewObjectUrlSize(props.versionId, { width: w, height: h });
}

async function ensureNaturalSize(): Promise<{ width: number; height: number }> {
  if (naturalWidth.value > 0 && naturalHeight.value > 0) {
    return { width: naturalWidth.value, height: naturalHeight.value };
  }

  const cachedImg = imgEl.value;
  if (cachedImg?.naturalWidth && cachedImg.naturalHeight) {
    const w = cachedImg.naturalWidth;
    const h = cachedImg.naturalHeight;
    naturalWidth.value = w;
    naturalHeight.value = h;
    setPosterPreviewObjectUrlSize(props.versionId, { width: w, height: h });
    return { width: w, height: h };
  }

  if (!objectUrl.value) {
    throw new Error("Preview not loaded");
  }

  const img = new Image();
  img.decoding = "async";
  img.src = objectUrl.value;

  if (typeof img.decode === "function") {
    await img.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) {
    throw new Error("Image size unavailable");
  }

  naturalWidth.value = w;
  naturalHeight.value = h;
  setPosterPreviewObjectUrlSize(props.versionId, { width: w, height: h });
  return { width: w, height: h };
}

type PhotoSwipeClass = typeof import("photoswipe").default;
let photoSwipePromise: Promise<PhotoSwipeClass> | null = null;
let photoSwipeCssPromise: Promise<unknown> | null = null;

async function getPhotoSwipe(): Promise<PhotoSwipeClass> {
  if (!photoSwipeCssPromise) {
    photoSwipeCssPromise = import("photoswipe/style.css");
  }
  if (!photoSwipePromise) {
    photoSwipePromise = import("photoswipe").then(mod => mod.default);
  }
  await photoSwipeCssPromise;
  return await photoSwipePromise;
}

async function openLightbox(): Promise<void> {
  if (state.value !== "ready" || !objectUrl.value) return;

  const { width, height } = await ensureNaturalSize();

  // Lightbox 打开期间也持有一份引用，避免 URL 被回收
  const lightboxRef = await acquirePosterPreviewObjectUrl(props.versionId, async () => {
    const { blob } = await posterAlphaService.downloadPngBlob(props.versionId);
    return blob;
  });

  let released = false;
  const safeRelease = () => {
    if (released) return;
    released = true;
    lightboxRef.release();
  };

  try {
    const PhotoSwipe = await getPhotoSwipe();

    const pswp = new PhotoSwipe({
      dataSource: [
        {
          src: lightboxRef.url,
          // 优先使用已加载的缩略图作为 opening placeholder，减少“先黑一下再显示”的观感
          msrc: objectUrl.value,
          width,
          height,
          element: imgEl.value ?? thumbEl.value ?? undefined,
          thumbCropped: true
        }
      ],
      paddingFn: viewportSize => {
        const isCompact = viewportSize.x < 480 || viewportSize.y < 480;
        const padY = isCompact ? 24 : 30;
        const padX = isCompact ? 18 : 24;
        return { top: padY, bottom: padY, left: padX, right: padX };
      },
      bgOpacity: 0.85,
      showHideOpacity: true,
      showHideAnimationType: "zoom",
      showAnimationDuration: 300,
      hideAnimationDuration: 300,
      wheelToZoom: true
    });

    let zoomIndicatorEl: HTMLElement | null = null;

    const updateZoomIndicator = () => {
      if (!zoomIndicatorEl) return;
      const slide = pswp.currSlide;
      if (!slide) return;
      zoomIndicatorEl.textContent = `${Math.round(slide.currZoomLevel * 100)}%`;
    };

    pswp.on("uiRegister", () => {
      pswp.ui?.registerElement({
        name: "zoomLevel",
        className: "pswp__zoom-level",
        appendTo: "bar",
        order: 9,
        onInit: el => {
          zoomIndicatorEl = el;
          el.setAttribute("aria-live", "polite");
          el.textContent = "100%";
        }
      });
    });

    pswp.on("afterInit", () => updateZoomIndicator());
    pswp.on("change", () => updateZoomIndicator());
    pswp.on("zoomPanUpdate", () => updateZoomIndicator());

    pswp.on("keydown", e => {
      const key = e.originalEvent.key;
      const isZoomIn = key === "+" || (key === "=" && e.originalEvent.shiftKey);
      const isZoomOut = key === "-" || key === "_";
      if (!isZoomIn && !isZoomOut) return;

      e.preventDefault();
      e.originalEvent.preventDefault();

      const slide = pswp.currSlide;
      if (!slide) return;

      const current = slide.currZoomLevel;
      const factor = isZoomIn ? 1.2 : 1 / 1.2;
      const next = Math.min(slide.zoomLevels.max, Math.max(slide.zoomLevels.min, current * factor));
      pswp.zoomTo(next, pswp.getViewportCenterPoint(), 200);
    });

    pswp.on("destroy", () => {
      zoomIndicatorEl = null;
      safeRelease();
    });

    pswp.init();
  } catch (error) {
    safeRelease();
    throw error;
  }
}

function handleClick(): void {
  if (state.value === "error") {
    void loadPreview();
    return;
  }

  void openLightbox().catch(() => {
    // Lightbox 打开失败不应影响对话继续使用；允许用户重试点击
  });
}

function handlePointerEnter(): void {
  if (state.value !== "ready") return;
  // 轻量预热：避免首次点击时动态 import 带来的额外等待
  void getPhotoSwipe();
}

watch(
  () => props.versionId,
  () => {
    if (!props.versionId) return;
    void loadPreview();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  loadSeq += 1;
  cleanup();
});

const showHoverAffordance = computed(() => state.value === "ready" && Boolean(objectUrl.value));
</script>

<template>
  <button
    ref="thumbEl"
    type="button"
    class="group relative w-42 min-w-11 aspect-3/4 min-h-11 overflow-hidden rounded-lg border border-border bg-surface-subtle text-left transition-transform duration-150 hover:shadow-sm hover:scale-[1.02] active:scale-[0.99]"
    :aria-label="state === 'error' ? '预览加载失败，点击重试' : '点击查看海报大图'"
    @click="handleClick"
    @pointerenter="handlePointerEnter"
  >
    <div v-if="state === 'loading'" class="absolute inset-0 flex items-center justify-center">
      <div class="flex items-center gap-2 text-xs text-muted">
        <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>加载预览…</span>
      </div>
    </div>

    <div v-else-if="state === 'error'" class="absolute inset-0 flex items-center justify-center p-3">
      <div class="text-center">
        <p class="text-xs text-red-600">加载失败</p>
        <p class="mt-1 text-[11px] text-muted">点击重试</p>
        <p v-if="errorMessage" class="mt-2 max-h-8 overflow-hidden text-[10px] text-muted-subtle wrap-break-word">
          {{ errorMessage }}
        </p>
      </div>
    </div>

    <img
      v-else-if="objectUrl"
      ref="imgEl"
      :src="objectUrl"
      alt="Poster preview thumbnail"
      class="w-full h-full object-cover"
      @load="handleImgLoad"
    />
  </button>
</template>

<style scoped>
:global(.pswp__zoom-level) {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  user-select: none;
}
</style>
