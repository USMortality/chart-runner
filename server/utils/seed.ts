export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping seed");
    return;
  }

  const auth = useAuth();

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Admin",
      },
    });
    if (result?.user) {
      console.log(`[seed] Admin user created: ${email}`);
    }
  } catch (e: any) {
    const msg = e?.message || e?.body?.message || String(e);
    if (msg.includes("already") || msg.includes("UNIQUE")) {
      console.log(`[seed] Admin user already exists: ${email}`);
    } else {
      console.log(`[seed] Admin seed note: ${msg}`);
    }
  }
}
