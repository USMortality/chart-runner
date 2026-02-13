<script setup lang="ts">
const toast = useToast();
const { formatDate } = useFormatDate();
const page = ref(1);
const { data, refresh } = useFetch("/api/jobs", {
  query: { page, limit: 20 },
  watch: [page],
});

const expandedLog = ref<number | null>(null);
const fixing = ref<number | null>(null);
const pushing = ref<number | null>(null);

function toggleLog(id: number) {
  expandedLog.value = expandedLog.value === id ? null : id;
}

async function cancelJob(id: number) {
  await $fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
  await refresh();
}

async function fixJob(id: number) {
  fixing.value = id;
  try {
    const result = await $fetch(`/api/jobs/${id}/fix`, { method: "POST" }) as any;
    toast.add({
      title: "Claude fix submitted",
      description: result.explanation || `New job #${result.jobId} created`,
      color: "success",
    });
    await refresh();
  } catch (e: any) {
    toast.add({
      title: "Fix failed",
      description: e?.data?.message || e.message,
      color: "error",
    });
  } finally {
    fixing.value = null;
  }
}

async function pushFix(id: number) {
  pushing.value = id;
  try {
    const result = await $fetch(`/api/jobs/${id}/push-fix`, { method: "POST" }) as any;
    toast.add({
      title: "Pushed to GitHub",
      description: result.gistUrl,
      color: "success",
    });
    await refresh();
  } catch (e: any) {
    toast.add({
      title: "Push failed",
      description: e?.data?.message || e.message,
      color: "error",
    });
  } finally {
    pushing.value = null;
  }
}

// Auto-refresh every 10 seconds
let refreshInterval: ReturnType<typeof setInterval>;
onMounted(() => {
  refreshInterval = setInterval(() => refresh(), 10000);
});
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
                <a
                  v-if="job.gistHtmlUrl"
                  :href="job.gistHtmlUrl"
                  target="_blank"
                  class="ml-1 text-gray-400 hover:text-gray-600 text-xs"
                  title="View on GitHub"
                >
                  GH
                </a>
              </td>
              <td class="py-2 px-3">
                <StatusBadge :status="job.status" />
              </td>
              <td class="py-2 px-3 text-gray-500">{{ job.triggeredBy }}</td>
              <td class="py-2 px-3 text-gray-500">{{ job.retryCount }}</td>
              <td class="py-2 px-3 text-gray-500">{{ formatDate(job.startedAt) }}</td>
              <td class="py-2 px-3 text-gray-500">{{ formatDate(job.finishedAt) }}</td>
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
                  v-if="job.status === 'failed'"
                  size="xs"
                  color="warning"
                  variant="outline"
                  :loading="fixing === job.id"
                  @click="fixJob(job.id)"
                >
                  Fix with Claude
                </UButton>
                <UButton
                  v-if="job.status === 'success' && job.hasFixedScript"
                  size="xs"
                  color="primary"
                  variant="outline"
                  :loading="pushing === job.id"
                  @click="pushFix(job.id)"
                >
                  Push to Gist
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
            <div v-if="job.fixExplanation" class="mb-2">
              <div class="text-xs font-medium text-blue-600 mb-1">Claude's Fix:</div>
              <pre class="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">{{ job.fixExplanation }}</pre>
            </div>
            <div v-if="job.errorLog" class="mb-2">
              <div class="text-xs font-medium text-red-600 mb-1">Error:</div>
              <pre class="bg-red-50 dark:bg-red-950 p-3 rounded text-xs overflow-auto max-h-64">{{ job.errorLog }}</pre>
            </div>
            <div v-if="job.outputLog">
              <div class="text-xs font-medium text-gray-600 mb-1">Output:</div>
              <pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-64">{{ job.outputLog }}</pre>
            </div>
            <div v-if="job.pngFiles && JSON.parse(job.pngFiles).length > 0">
              <div class="text-xs font-medium text-gray-600 mb-1">Output files:</div>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="f in JSON.parse(job.pngFiles)" :key="f" variant="subtle" size="sm">
                  {{ f }}
                </UBadge>
              </div>
            </div>
            <div v-if="!job.errorLog && !job.outputLog && !job.hasFixedScript" class="text-sm text-gray-500">
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
