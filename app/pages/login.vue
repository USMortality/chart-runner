<script setup lang="ts">
definePageMeta({ layout: false });

const { signIn } = useAuthClient();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function handleLogin() {
  error.value = "";
  loading.value = true;
  try {
    const result = await signIn.email({
      email: email.value,
      password: password.value,
    });
    if (result.error) {
      error.value = result.error.message || "Login failed";
    } else {
      router.push("/");
    }
  } catch (e: any) {
    error.value = e.message || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div class="w-full max-w-sm">
        <h1 class="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          Chart Runner
        </h1>
        <UCard>
          <form @submit.prevent="handleLogin" class="space-y-4">
            <UFormField label="Email">
              <UInput v-model="email" type="email" required placeholder="admin@example.com" class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="password" type="password" required placeholder="Password" class="w-full" />
            </UFormField>
            <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
            <UButton type="submit" block :loading="loading">
              Sign in
            </UButton>
          </form>
        </UCard>
      </div>
    </div>
  </UApp>
</template>
