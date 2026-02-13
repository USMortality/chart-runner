<script setup lang="ts">
const { data: status, refresh: refreshStatus } = useFetch("/api/status");
const { data: gists, refresh: refreshGists } = useFetch("/api/gists");

const syncing = ref(false);
const runningAll = ref(false);

async function syncGists() {
  syncing.value = true;
  try {
    await $fetch("/api/gists/sync", { method: "POST" });
    await refreshGists();
    await refreshStatus();
  } finally {
    syncing.value = false;
  }
}

async function runAll() {
  runningAll.value = true;
  try {
    await $fetch("/api/jobs/run-all", { method: "POST" });
    await refreshGists();
    await refreshStatus();
  } finally {
    runningAll.value = false;
  }
}

async function runGist(id: number) {
  await $fetch(`/api/gists/${id}/run`, { method: "POST" });
  await refreshGists();
  await refreshStatus();
}

// Auto-refresh every 10 seconds
const refreshInterval = setInterval(() => {
  refreshGists();
  refreshStatus();
}, 10000);

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
        <UButton @click="runAll" :loading="runningAll" color="primary">
          Run All
        </UButton>
      </div>
    </div>

    <!-- Status Cards -->
    <div v-if="status" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <UCard>
        <div class="text-sm text-gray-500">Active Gists</div>
        <div class="text-2xl font-bold">{{ status.gists?.active || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Total Jobs</div>
        <div class="text-2xl font-bold">{{ status.jobs?.total || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Successful</div>
        <div class="text-2xl font-bold text-green-600">{{ status.jobs?.success || 0 }}</div>
      </UCard>
      <UCard>
        <div class="text-sm text-gray-500">Failed</div>
        <div class="text-2xl font-bold text-red-600">{{ status.jobs?.failed || 0 }}</div>
      </UCard>
    </div>

    <!-- Gists Table -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">Gists</h2>
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
              v-for="gist in (gists || [])"
              :key="gist.id"
              class="border-b border-gray-100 dark:border-gray-800"
            >
              <td class="py-2 px-3">
                <NuxtLink :to="`/gists/${gist.id}`" class="text-blue-600 hover:underline">
                  {{ gist.filename }}
                </NuxtLink>
              </td>
              <td class="py-2 px-3 text-gray-500 max-w-xs truncate">
                {{ gist.description || '-' }}
              </td>
              <td class="py-2 px-3">
                <StatusBadge :status="gist.latestRun?.status || 'never_run'" />
              </td>
              <td class="py-2 px-3 text-gray-500">
                {{ gist.latestRun?.finishedAt || '-' }}
              </td>
              <td class="py-2 px-3">
                <UButton
                  size="xs"
                  variant="outline"
                  @click="runGist(gist.id)"
                  :disabled="gist.latestRun?.status === 'running'"
                >
                  Run
                </UButton>
              </td>
            </tr>
          </tbody>
          <tbody v-if="!gists || gists.length === 0">
            <tr>
              <td colspan="5" class="text-center py-8 text-gray-500">
                No gists found. Click "Sync Gists" to discover chart gists.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
