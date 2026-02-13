<script setup lang="ts">
const route = useRoute();
const gistId = route.params.id;

const { data: gists, refresh: refreshGists } = useFetch("/api/gists");
const { data: jobsData, refresh: refreshJobs } = useFetch("/api/jobs", {
  query: { limit: 50 },
});

const gist = computed(() =>
  (gists.value || []).find((g: any) => g.id === Number(gistId))
);

const gistJobs = computed(() =>
  (jobsData.value?.jobs || []).filter((j: any) => j.gistId === Number(gistId))
);

const expandedLog = ref<number | null>(null);

function toggleLog(id: number) {
  expandedLog.value = expandedLog.value === id ? null : id;
}

async function runGist() {
  await $fetch(`/api/gists/${gistId}/run`, { method: "POST" });
  await refreshGists();
  await refreshJobs();
}

async function cancelJob(id: number) {
  await $fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
  await refreshJobs();
}

// Auto-refresh
const refreshInterval = setInterval(() => {
  refreshGists();
  refreshJobs();
}, 10000);
onUnmounted(() => clearInterval(refreshInterval));
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <UButton to="/" variant="ghost" size="sm">Back</UButton>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ gist?.filename || `Gist #${gistId}` }}
      </h1>
    </div>

    <UCard v-if="gist">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-gray-500">Filename:</span>
          <span class="ml-2 font-mono">{{ gist.filename }}</span>
        </div>
        <div>
          <span class="text-gray-500">Status:</span>
          <span class="ml-2"><StatusBadge :status="gist.latestRun?.status || 'never_run'" /></span>
        </div>
        <div>
          <span class="text-gray-500">Description:</span>
          <span class="ml-2">{{ gist.description || '-' }}</span>
        </div>
        <div>
          <span class="text-gray-500">Active:</span>
          <span class="ml-2">{{ gist.active ? 'Yes' : 'No' }}</span>
        </div>
        <div>
          <span class="text-gray-500">GitHub:</span>
          <a :href="gist.htmlUrl" target="_blank" class="ml-2 text-blue-600 hover:underline">
            View Gist
          </a>
        </div>
      </div>
      <template #footer>
        <UButton @click="runGist" :disabled="gist.latestRun?.status === 'running'">
          Run Now
        </UButton>
      </template>
    </UCard>

    <!-- Run History -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Run History</h2>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3">ID</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">Triggered</th>
              <th class="text-left py-2 px-3">Retries</th>
              <th class="text-left py-2 px-3">Started</th>
              <th class="text-left py-2 px-3">Finished</th>
              <th class="text-left py-2 px-3">PNGs</th>
              <th class="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="job in gistJobs"
              :key="job.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 px-3">#{{ job.id }}</td>
              <td class="py-2 px-3"><StatusBadge :status="job.status" /></td>
              <td class="py-2 px-3 text-gray-500">{{ job.triggeredBy }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.retryCount }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.startedAt || '-' }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.finishedAt || '-' }}</td>
              <td class="py-2 px-3 text-gray-500">
                {{ job.pngFiles ? JSON.parse(job.pngFiles).length : 0 }}
              </td>
              <td class="py-2 px-3 space-x-1">
                <UButton
                  v-if="job.status === 'running' || job.status === 'pending'"
                  size="xs"
                  color="error"
                  variant="outline"
                  @click="cancelJob(job.id)"
                >
                  Cancel
                </UButton>
                <UButton size="xs" variant="ghost" @click="toggleLog(job.id)">
                  {{ expandedLog === job.id ? 'Hide' : 'Logs' }}
                </UButton>
              </td>
            </tr>
          </tbody>
          <tbody v-if="gistJobs.length === 0">
            <tr>
              <td colspan="8" class="text-center py-8 text-gray-500">
                No runs yet. Click "Run Now" to execute this gist.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Log Viewer -->
      <div v-if="expandedLog" class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <template v-for="job in gistJobs" :key="'log-' + job.id">
          <div v-if="job.id === expandedLog">
            <h3 class="text-sm font-semibold mb-2">Job #{{ job.id }} Logs</h3>
            <div v-if="job.errorLog" class="mb-2">
              <div class="text-xs font-medium text-red-600 mb-1">Error:</div>
              <pre class="bg-red-50 dark:bg-red-950 p-3 rounded text-xs overflow-auto max-h-64">{{ job.errorLog }}</pre>
            </div>
            <div v-if="job.outputLog">
              <div class="text-xs font-medium text-gray-600 mb-1">Output:</div>
              <pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-64">{{ job.outputLog }}</pre>
            </div>
            <div v-if="!job.errorLog && !job.outputLog" class="text-sm text-gray-500">
              No logs available.
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
