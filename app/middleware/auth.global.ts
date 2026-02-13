export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") return;

  // Skip auth check on server side
  if (import.meta.server) return;

  const client = useAuthClient();
  const { data } = await client.getSession();

  if (!data?.user) {
    return navigateTo("/login");
  }
});
