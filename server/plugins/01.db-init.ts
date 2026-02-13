import { runMigrations } from "../database/migrate";

export default defineNitroPlugin(async () => {
  console.log("[plugin] Initializing database...");
  runMigrations();
  await runAuthMigrations();
  await seedAdmin();
});
