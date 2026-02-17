<script setup lang="ts">
definePageMeta({ layout: "public" });

interface ChartEntry {
  title: string;
  url: string;
  charts: string[];
}

const { data: chartsData } = useFetch<ChartEntry[]>("/api/charts");

const expandedSections = ref<Set<string>>(new Set());
const lightboxSrc = ref<string | null>(null);

function sectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}

function toggleSection(id: string) {
  if (expandedSections.value.has(id)) {
    expandedSections.value.delete(id);
    history.replaceState(null, "", " ");
  } else {
    expandedSections.value.add(id);
    history.replaceState(null, "", "#" + id);
  }
  // Trigger reactivity
  expandedSections.value = new Set(expandedSections.value);
}

function scrollToSection(id: string) {
  if (!expandedSections.value.has(id)) {
    expandedSections.value.add(id);
    expandedSections.value = new Set(expandedSections.value);
  }
  history.replaceState(null, "", "#" + id);
  nextTick(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function navigateToHash(hash: string) {
  if (!hash || !chartsData.value) return;
  const id = hash.replace(/^#/, "");
  const valid = chartsData.value.some((e) => sectionId(e.title) === id);
  if (valid) {
    scrollToSection(id);
  }
}

onMounted(() => {
  window.addEventListener("hashchange", () => {
    navigateToHash(window.location.hash);
  });
});

watch(chartsData, (data) => {
  if (data && window.location.hash) {
    nextTick(() => navigateToHash(window.location.hash));
  }
});

function toggleAll() {
  if (!chartsData.value) return;
  const allExpanded = expandedSections.value.size === chartsData.value.length;
  if (allExpanded) {
    expandedSections.value = new Set();
  } else {
    expandedSections.value = new Set(chartsData.value.map((e) => sectionId(e.title)));
  }
}

const allExpanded = computed(
  () => chartsData.value && expandedSections.value.size === chartsData.value.length
);
</script>

<template>
  <div>
    <!-- Lightbox -->
    <div
      v-if="lightboxSrc"
      class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-pointer"
      @click="lightboxSrc = null"
    >
      <img :src="lightboxSrc" class="max-w-[95%] max-h-[95%] object-contain rounded-lg" />
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Additional Charts</h1>
          <p class="text-sm text-gray-500 mt-1" v-if="chartsData">
            {{ chartsData.length }} chart sets
          </p>
        </div>
        <button
          v-if="chartsData && chartsData.length > 0"
          class="text-sm text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
          @click="toggleAll"
        >
          {{ allExpanded ? "Collapse All" : "Expand All" }}
        </button>
      </div>

      <!-- Table of Contents -->
      <div v-if="chartsData && chartsData.length > 0" class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Table of Contents</h2>
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
            <a
              v-for="entry in chartsData"
              :key="entry.title"
              :href="`#${sectionId(entry.title)}`"
              class="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              @click="scrollToSection(sectionId(entry.title))"
            >
              <span class="text-gray-900 dark:text-gray-100">{{ entry.title }}</span>
              <span class="text-xs text-gray-400">{{ entry.charts.length }} chart{{ entry.charts.length !== 1 ? "s" : "" }}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="!chartsData" class="flex flex-col items-center justify-center py-16">
        <div class="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p class="text-gray-500">Loading charts...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="chartsData.length === 0" class="text-center py-16 text-gray-500">
        No charts available yet.
      </div>

      <!-- Chart Sections -->
      <div v-else class="space-y-3">
        <div
          v-for="entry in chartsData"
          :key="entry.title"
          :id="sectionId(entry.title)"
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
        >
          <!-- Accordion Header -->
          <button
            class="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            @click="toggleSection(sectionId(entry.title))"
          >
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ entry.title }}</h3>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-sm text-gray-500">{{ entry.charts.length }} chart{{ entry.charts.length !== 1 ? "s" : "" }}</span>
                <a
                  :href="entry.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-sm text-gray-400 hover:text-blue-600 transition-colors"
                  @click.stop
                >
                  Source
                </a>
              </div>
            </div>
            <svg
              class="w-5 h-5 text-gray-400 flex-shrink-0 ml-4 transition-transform duration-300"
              :class="{ 'rotate-180': expandedSections.has(sectionId(entry.title)) }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Accordion Content (only render images when expanded) -->
          <div v-if="expandedSections.has(sectionId(entry.title))" class="px-6 pb-6 space-y-4">
            <div v-for="chartUrl in entry.charts" :key="chartUrl" class="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
              <img
                :src="chartUrl"
                :alt="entry.title"
                class="w-full max-w-2xl cursor-pointer rounded-lg hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
                @click="lightboxSrc = chartUrl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
