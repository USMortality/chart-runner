import { createAuthClient } from "better-auth/vue";

let _client: ReturnType<typeof createAuthClient> | null = null;

export const useAuthClient = () => {
  if (!_client) {
    const baseURL = import.meta.server
      ? (process.env.BETTER_AUTH_URL || "http://localhost:3000")
      : window.location.origin;
    _client = createAuthClient({
      baseURL,
    });
  }
  return _client;
};
