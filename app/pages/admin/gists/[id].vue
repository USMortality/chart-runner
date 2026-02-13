<script setup lang="ts">
const toast = useToast();
const { formatDate } = useFormatDate();
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

const latestPngs = computed(() => {
  const successJob = gistJobs.value.find((j: any) => j.status === "success" && j.pngFiles);
  if (!successJob?.pngFiles) return [];
  try { return JSON.parse(successJob.pngFiles); } catch { return []; }
});

const expandedLog = ref<number | null>(null);
const fixing = ref<number | null>(null);
const pushing = ref<number | null>(null);
const togglingGist = ref(false);

function toggleLog(id: number) {
  expandedLog.value = expandedLog.value === id ? null : id;
}

async function toggleGist() {
  togglingGist.value = true;
  try {
    const result = await $fetch(`/api/gists/${gistId}/toggle`, { method: "POST" }) as any;
    toast.add({ title: `${result.filename} ${result.action}`, color: "success" });
    await refreshGists();
  } catch (e: any) {
    toast.add({ title: "Toggle failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    togglingGist.value = false;
  }
}

async function runGist() {
  try {
    await $fetch(`/api/gists/${gistId}/run`, { method: "POST" });
    toast.add({ title: "Job started", color: "success" });
    await refreshGists();
    await refreshJobs();
  } catch (e: any) {
    toast.add({ title: "Run failed", description: e?.data?.message || e.message, color: "error" });
  }
}

async function cancelJob(id: number) {
  await $fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
  await refreshJobs();
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
    await refreshJobs();
  } catch (e: any) {
    toast.add({ title: "Fix failed", description: e?.data?.message || e.message, color: "error" });
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
    await refreshJobs();
  } catch (e: any) {
    toast.add({ title: "Push failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    pushing.value = null;
  }
}

// Auto-refresh
let refreshInterval: ReturnType<typeof setInterval>;
onMounted(() => {
  refreshInterval = setInterval(() => {
    refreshGists();
    refreshJobs();
  }, 10000);
});
onUnmounted(() => clearInterval(refreshInterval));
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <UButton to="/admin" variant="ghost" size="sm">Back</UButton>
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
        <div class="flex gap-2">
          <UButton @click="runGist" :disabled="gist.latestRun?.status === 'running' || !gist.active">
            Run Now
          </UButton>
          <UButton
            :color="gist.active ? 'warning' : 'success'"
            variant="outline"
            :loading="togglingGist"
            @click="toggleGist"
          >
            {{ gist.active ? 'Disable' : 'Enable' }}
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Output PNGs from latest successful run -->
    <UCard v-if="latestPngs.length > 0">
      <template #header>
        <h2 class="text-lg font-semibold">Output Files</h2>
      </template>
      <div class="flex flex-wrap gap-2">
        <UBadge v-for="f in latestPngs" :key="f" variant="subtle" size="sm">
          {{ f }}
        </UBadge>
      </div>
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
              <td class="py-2 px-3 text-gray-500">{{ formatDate(job.startedAt) }}</td>
              <td class="py-2 px-3 text-gray-500">{{ formatDate(job.finishedAt) }}</td>
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
            <div v-if="!job.errorLog && !job.outputLog && !job.hasFixedScript" class="text-sm text-gray-500">
              No logs available.
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
