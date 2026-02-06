<script setup lang="ts">
import { HomeLayout, LocationForm, CandidatePanel } from "@/components/home";
import { onMounted, watch, computed } from "vue";
import { POSTER_CATEGORIES, POSTER_CATEGORY_LABELS, type PosterCategory } from "@/types/posters";
import { useLocationForm } from "@/composables/home";

const form = useLocationForm();

const categoryOptions = computed(() =>
  POSTER_CATEGORIES.map(c => ({
    value: c as PosterCategory,
    label: POSTER_CATEGORY_LABELS[c]
  }))
);

// ==================== Event Handlers ====================

function handleCategoryUpdate(value: PosterCategory): void {
  form.category.value = value;
}

function handleLocationQueryUpdate(value: string): void {
  form.locationQuery.value = value;
}

function handleRetryLoadThemes(): void {
  void form.loadThemesByCategory(form.category.value);
}

function handleSubmit(): void {
  void form.startGeocode();
}

// ==================== Watchers ====================

watch(
  () => form.category.value,
  next => {
    form.resetCandidates();
    void form.loadThemesByCategory(next);
  }
);

onMounted(() => {
  void form.loadThemesByCategory(form.category.value);
});
</script>

<template>
  <HomeLayout>
    <template #form>
      <LocationForm
        :location-query="form.locationQuery.value"
        :category="form.category.value"
        :category-options="categoryOptions"
        :is-themes-loading="form.themesLoading.value"
        :is-geocode-loading="form.geocodeLoading.value"
        :is-create-session-loading="form.createSessionLoading.value"
        :can-start="form.canStart.value"
        :themes-error="form.themesError.value"
        :geocode-error="form.geocodeError.value"
        :create-session-error="form.createSessionError.value"
        @update:location-query="handleLocationQueryUpdate"
        @update:category="handleCategoryUpdate"
        @retry-load-themes="handleRetryLoadThemes"
        @submit="handleSubmit"
      />

      <div class="fixed bottom-2 sm:bottom-4 inset-x-0 px-4 sm:px-6 z-10 safe-area-bottom">
        <p class="text-center text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
          服务使用免费的
          <a
            class="font-medium underline underline-offset-2 hover:text-black transition-colors"
            href="https://wiki.openstreetmap.org/wiki/Overpass_API"
            target="_blank"
            rel="noopener noreferrer"
          >
            Overpass API
          </a>
          和
          <a
            class="font-medium underline underline-offset-2 hover:text-black transition-colors"
            href="https://nominatim.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Nominatim
          </a>
          ，容易受到网络波动影响而生成失败。大城市多建筑物需要等待较长时间。
        </p>
      </div>
    </template>

    <template #overlay>
      <CandidatePanel
        :candidates="form.candidates.value"
        :is-disabled="form.geocodeLoading.value || form.createSessionLoading.value"
        @select="form.createSessionFromCandidate"
        @close="form.resetCandidates"
      />
    </template>
  </HomeLayout>
</template>
