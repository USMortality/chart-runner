<script setup lang="ts">
const { useSession, signOut } = useAuthClient();
const sessionState = useSession();
const session = computed(() => sessionState.value?.data);
const router = useRouter();

async function handleSignOut() {
  await signOut();
  router.push("/");
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-6">
            <NuxtLink to="/admin" class="text-xl font-bold text-gray-900 dark:text-white">
              Chart Runner
            </NuxtLink>
            <nav class="flex gap-4">
              <NuxtLink to="/" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Charts
              </NuxtLink>
              <NuxtLink v-if="session?.user" to="/admin" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Dashboard
              </NuxtLink>
              <NuxtLink v-if="session?.user" to="/admin/jobs" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Jobs
              </NuxtLink>
            </nav>
          </div>
          <div v-if="session?.user" class="flex items-center gap-4">
            <span class="text-sm text-gray-500">{{ session.user.email }}</span>
            <UButton size="sm" variant="ghost" @click="handleSignOut">
              Sign out
            </UButton>
          </div>
        </div>
      </div>
    </header>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
