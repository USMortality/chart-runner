<script setup lang="ts">
const toast = useToast();
const { formatDate } = useFormatDate();
const { data: status, refresh: refreshStatus } = useFetch("/api/status");
const { data: gists, refresh: refreshGists } = useFetch("/api/gists");

const syncing = ref(false);
const runningAll = ref(false);
const rerunningFailed = ref(false);
const toggling = ref<number | null>(null);

const activeGists = computed(() => (gists.value || []).filter((g: any) => g.active));
const disabledGists = computed(() => (gists.value || []).filter((g: any) => !g.active));

async function syncGists() {
  syncing.value = true;
  try {
    const result = await $fetch("/api/gists/sync", { method: "POST" });
    toast.add({ title: `Synced ${result.synced} chart gists`, color: "success" });
    await refreshGists();
    await refreshStatus();
  } catch (e: any) {
    toast.add({ title: "Sync failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    syncing.value = false;
  }
}

async function runAll() {
  runningAll.value = true;
  try {
    const result = await $fetch("/api/jobs/run-all", { method: "POST" });
    toast.add({ title: result.message, color: "success" });
    await refreshGists();
    await refreshStatus();
  } catch (e: any) {
    toast.add({ title: "Run all failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    runningAll.value = false;
  }
}

async function runGist(id: number) {
  try {
    await $fetch(`/api/gists/${id}/run`, { method: "POST" });
    toast.add({ title: "Job started", color: "success" });
    await refreshGists();
    await refreshStatus();
  } catch (e: any) {
    toast.add({ title: "Run failed", description: e?.data?.message || e.message, color: "error" });
  }
}

async function rerunFailed() {
  rerunningFailed.value = true;
  try {
    const result = await $fetch("/api/jobs/rerun-failed", { method: "POST" }) as any;
    toast.add({ title: result.message, color: "success" });
    await refreshGists();
    await refreshStatus();
  } catch (e: any) {
    toast.add({ title: "Rerun failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    rerunningFailed.value = false;
  }
}

async function toggleGist(id: number) {
  toggling.value = id;
  try {
    const result = await $fetch(`/api/gists/${id}/toggle`, { method: "POST" }) as any;
    toast.add({ title: `${result.filename} ${result.action}`, color: "success" });
    await refreshGists();
    await refreshStatus();
  } catch (e: any) {
    toast.add({ title: "Toggle failed", description: e?.data?.message || e.message, color: "error" });
  } finally {
    toggling.value = null;
  }
}

// Auto-refresh every 10 seconds
let refreshInterval: ReturnType<typeof setInterval>;
onMounted(() => {
  refreshInterval = setInterval(() => {
    refreshGists();
    refreshStatus();
  }, 10000);
});
onUnmounted(() => clearInterval(refreshInterval));
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <div class="flex gap-2">
        <UButton @click="syncGists" :loading="syncing" variant="outline">
          Sync Gists
        </UButton>
        <UButton @click="rerunFailed" :loading="rerunningFailed" variant="outline" color="warning" :disabled="!status?.jobs?.failed">
          Rerun Failed
        </UButton>
        <UButton @click="runAll" :loading="runningAll" color="primary">
          Run All
        </UButton>
      </div>
    </div>

    <!-- Config Info -->
    <div v-if="status" class="flex flex-wrap gap-3 text-xs text-gray-500">
      <span>GitHub: <strong>{{ status.githubUser }}</strong></span>
      <span>Prefix: <strong>{{ status.gistPrefix }}*.r</strong></span>
      <span>Schedule: <strong>{{ status.cronSchedule }}</strong></span>
      <span>MinIO: <StatusBadge :status="status.minioConfigured ? 'success' : 'failed'" /></span>
      <span>Claude: <StatusBadge :status="status.claudeConfigured ? 'success' : 'failed'" /></span>
      <span>GitHub Push: <StatusBadge :status="status.githubTokenConfigured ? 'success' : 'failed'" /></span>
    </div>

    <!-- Status Cards -->
    <div v-if="status" class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <UCard>
        <div class="text-sm text-gray-500">Active</div>
        <div class="text-2xl font-bold">{{ status.gists?.active || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Disabled</div>
        <div class="text-2xl font-bold text-gray-400">{{ status.gists?.disabled || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Successful</div>
        <div class="text-2xl font-bold text-green-600">{{ status.jobs?.success || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Failed</div>
        <div class="text-2xl font-bold text-red-600">{{ status.jobs?.failed || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Running</div>
        <div class="text-2xl font-bold text-blue-600">{{ status.jobs?.running || 0 }}</div>
      </UCard>
    </div>

    <!-- Active Gists Table -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Active Gists</h2>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3">Filename</th>
              <th class="text-left py-2 px-3">Description</th>
              <th class="text-left py-2 px-3">Status</th>
              <th class="text-left py-2 px-3">Last Run</th>
              <th class="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="gist in activeGists"
              :key="gist.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 px-3">
                <NuxtLink :to="`/admin/gists/${gist.id}`" class="text-blue-600 hover:underline">
                  {{ gist.filename }}
                </NuxtLink>
                <a
                  :href="gist.htmlUrl"
                  target="_blank"
                  class="ml-1 text-gray-400 hover:text-gray-600 text-xs"
                  title="View on GitHub"
                >
                  GH
                </a>
              </td>
              <td class="py-2 px-3 text-gray-500 max-w-xs truncate">
                {{ gist.description || '-' }}
              </td>
              <td class="py-2 px-3">
                <StatusBadge :status="gist.latestRun?.status || 'never_run'" />
              </td>
              <td class="py-2 px-3 text-gray-500">
                {{ formatDate(gist.latestRun?.finishedAt) }}
              </td>
              <td class="py-2 px-3 space-x-1">
                <UButton
                  size="xs"
                  variant="outline"
                  @click="runGist(gist.id)"
                  :disabled="gist.latestRun?.status === 'running'"
                >
                  Run
                </UButton>
                <NuxtLink
                  v-if="gist.latestRun"
                  :to="`/admin/gists/${gist.id}`"
                >
                  <UButton size="xs" variant="ghost">
                    Logs
                  </UButton>
                </NuxtLink>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="warning"
                  :loading="toggling === gist.id"
                  @click="toggleGist(gist.id)"
                >
                  Disable
                </UButton>
              </td>
            </tr>
          </tbody>
          <tbody v-if="activeGists.length === 0">
            <tr>
              <td colspan="5" class="text-center py-8 text-gray-500">
                No active gists. Click "Sync Gists" to discover chart gists.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Disabled Gists Table -->
    <UCard v-if="disabledGists.length > 0">
      <template #header>
        <h2 class="text-lg font-semibold text-gray-500">Disabled Gists</h2>
      </template>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3">Filename</th>
              <th class="text-left py-2 px-3">Description</th>
              <th class="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="gist in disabledGists"
              :key="gist.id"
              class="border-b border-gray-100 dark:border-gray-800 opacity-60"
            >
              <td class="py-2 px-3">
                <span class="font-mono text-gray-500">{{ gist.filename }}</span>
                <a
                  :href="gist.htmlUrl"
                  target="_blank"
                  class="ml-1 text-gray-400 hover:text-gray-600 text-xs"
                  title="View on GitHub"
                >
                  GH
                </a>
              </td>
              <td class="py-2 px-3 text-gray-500 max-w-xs truncate">
                {{ gist.description || '-' }}
              </td>
              <td class="py-2 px-3">
                <UButton
                  size="xs"
                  variant="outline"
                  color="success"
                  :loading="toggling === gist.id"
                  @click="toggleGist(gist.id)"
                >
                  Enable
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
