import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Returns true only when there are zero admins in the system.
export const setupNeeded = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return { needed: (count ?? 0) === 0 };
});

// Bootstrap the first admin. Refuses if any admin already exists.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[a-z0-9_.-]+$/i),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      throw new Error("Setup is already complete");
    }
    const username = data.username.toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username, full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed");

    const userId = created.user.id;
    const { error: pErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      username,
      full_name: data.full_name,
      email: data.email,
      job_title: "Department Admin",
    });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    return { ok: true };
  });
