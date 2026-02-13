import { createAuthClient } from "better-auth/vue";

export const useAuthClient = () => {
  return createAuthClient({
    baseURL: "/api/auth",
  });
};
