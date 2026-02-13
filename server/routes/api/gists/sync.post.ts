import { syncGists } from "../../../services/gist-sync";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const result = await syncGists();
  return result;
});
