import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { getMigrations } from "better-auth/db";
import Database from "better-sqlite3";

const authConfig = () => ({
  database: new Database(process.env.DATABASE_URL || "sqlite.db"),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ],
});

let _auth: ReturnType<typeof betterAuth> | null = null;

export function useAuth() {
  if (!_auth) {
    _auth = betterAuth(authConfig());
  }
  return _auth;
}

export async function runAuthMigrations() {
  const config = authConfig();
  const { runMigrations } = await getMigrations(config);
  await runMigrations();
  console.log("[auth] Migrations applied");
}

export async function requireAdmin(event: any) {
  const auth = useAuth();
  const session = await auth.api.getSession({
    headers: event.headers,
  });
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return session;
}
