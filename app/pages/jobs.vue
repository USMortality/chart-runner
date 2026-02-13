<script setup lang="ts">
const page = ref(1);
const { data, refresh } = useFetch("/api/jobs", {
  query: { page, limit: 20 },
  watch: [page],
});

const expandedLog = ref<number | null>(null);

function toggleLog(id: number) {
  expandedLog.value = expandedLog.value === id ? null : id;
}

async function cancelJob(id: number) {
  await $fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
  await refresh();
}

// Auto-refresh every 10 seconds
const refreshInterval = setInterval(() => refresh(), 10000);
onUnmounted(() => clearInterval(refreshInterval));
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Job History</h1>
      <UButton variant="outline" @click="refresh">Refresh</UButton>
    </div>

    <UCard>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3">ID</th>
              <th class="text-left py-2 px-3">Gist</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">Triggered</th>
              <th class="text-left py-2 px-3">Retries</th>
              <th class="text-left py-2 px-3">Started</th>
              <th class="text-left py-2 px-3">Finished</th>
              <th class="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="job in data?.jobs || []"
              :key="job.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 px-3">#{{ job.id }}</td>
              <td class="py-2 px-3">
                <NuxtLink
                  v-if="job.gistId"
                  :to="`/gists/${job.gistId}`"
                  class="text-blue-600 hover:underline"
                >
                  {{ job.gistFilename || `Gist #${job.gistId}` }}
                </NuxtLink>
              </td>
              <td class="py-2 px-3">
                <StatusBadge :status="job.status" />
              </td>
              <td class="py-2 px-3 text-gray-500">{{ job.triggeredBy }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.retryCount }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.startedAt || '-' }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.finishedAt || '-' }}</td>
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
                <UButton
                  size="xs"
                  variant="ghost"
                  @click="toggleLog(job.id)"
                >
                  {{ expandedLog === job.id ? 'Hide' : 'Logs' }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Log Viewer -->
      <div v-if="expandedLog" class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <template v-for="job in data?.jobs || []" :key="'log-' + job.id">
          <div v-if="job.id === expandedLog">
            <h3 class="text-sm font-semibold mb-2">
              Job #{{ job.id }} Logs
            </h3>
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

      <!-- Pagination -->
      <div class="flex justify-center gap-2 mt-4">
        <UButton
          size="xs"
          variant="outline"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </UButton>
        <span class="text-sm text-gray-500 self-center">Page {{ page }}</span>
        <UButton
          size="xs"
          variant="outline"
          :disabled="(data?.jobs || []).length < 20"
          @click="page++"
        >
          Next
        </UButton>
      </div>
    </UCard>
  </div>
</template>
