<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <NuxtLink to="/" class="text-xl font-bold text-gray-900 dark:text-white">
            Mortality.Watch
          </NuxtLink>
          <div class="flex items-center gap-3">
            <a
              href="https://www.mortality.watch/"
              class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Main Site
            </a>
            <NuxtLink to="/admin">
              <UButton size="sm" variant="ghost">Login</UButton>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
