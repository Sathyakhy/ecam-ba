import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public: resolve username -> email so the user can sign in with username
export const resolveUsernameToEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ username: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (error) throw new Error("Lookup failed");
    if (!row) throw new Error("Invalid username or password");
    return { email: row.email };
  });

// Public: look up the email for a username so the client can call
// supabase.auth.resetPasswordForEmail with the correct window.location.origin
// as redirectTo. Returns { email: null } when not found so we don't leak existence.
export const lookupResetEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ username: z.string().trim().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    return { email: row?.email ?? null };
  });

// Admin: create a new staff user
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .min(3)
          .max(32)
          .regex(/^[a-z0-9_.-]+$/i, "lowercase letters, numbers, _ . -"),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(128),
        job_title: z.string().trim().max(120).optional().nullable(),
        department: z.string().trim().max(120).optional().nullable(),
        role: z.enum(["admin", "staff"]).default("staff"),
        manager_id: z.string().uuid().optional().nullable(),
        start_date: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const username = data.username.toLowerCase();

    // Ensure username is unique
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) throw new Error("Username already taken");

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { username, full_name: data.full_name },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message || "Failed to create user");
    }

    const userId = created.user.id;

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      username,
      full_name: data.full_name,
      email: data.email,
      job_title: data.job_title ?? null,
      department: data.department ?? null,
      manager_id: data.manager_id ?? null,
      start_date: data.start_date ?? null,
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profileErr.message);
    }

    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: data.role,
    });

    return { id: userId };
  });

// Admin: delete user
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin"))
      throw new Error("Forbidden: admin only");
    if (data.user_id === context.userId)
      throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: update existing user
export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(255),
        username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.\-]+$/).optional(),
        job_title: z.string().trim().max(120).nullable().optional(),
        department: z.string().trim().max(120).nullable().optional(),
        manager_id: z.string().uuid().nullable().optional(),
        mentor_id: z.string().uuid().nullable().optional(),
        start_date: z.string().nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        avatar_url: z.string().trim().max(2048).nullable().optional(),
        role: z.enum(["admin", "staff"]).optional(),
        password: z.string().min(8).max(128).optional().nullable(),
        phone: z.string().trim().max(40).nullable().optional(),
        date_of_birth: z.string().nullable().optional(),
        gender: z.string().trim().max(40).nullable().optional(),
        address: z.string().trim().max(500).nullable().optional(),
        nationality: z.string().trim().max(80).nullable().optional(),
        emergency_contact_name: z.string().trim().max(120).nullable().optional(),
        emergency_contact_phone: z.string().trim().max(40).nullable().optional(),
        bio: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden: admin only");

    let username: string | undefined;
    if (data.username) {
      username = data.username.toLowerCase();
      const { data: clash } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", data.user_id)
        .maybeSingle();
      if (clash) throw new Error("Username already taken");
    }

    const profilePatch: Record<string, unknown> = {
      full_name: data.full_name,
      email: data.email,
      job_title: data.job_title ?? null,
      department: data.department ?? null,
      manager_id: data.manager_id ?? null,
      mentor_id: data.mentor_id ?? null,
      start_date: data.start_date ?? null,
      status: data.status ?? "active",
      avatar_url: data.avatar_url ?? null,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      gender: data.gender ?? null,
      address: data.address ?? null,
      nationality: data.nationality ?? null,
      emergency_contact_name: data.emergency_contact_name ?? null,
      emergency_contact_phone: data.emergency_contact_phone ?? null,
      bio: data.bio ?? null,
    };
    if (username) profilePatch.username = username;

    const { error: pErr } = await supabaseAdmin.from("profiles").update(profilePatch as never).eq("id", data.user_id);
    if (pErr) throw new Error(pErr.message);

    const authPatch: { email?: string; password?: string; email_confirm?: boolean } = {
      email: data.email,
      email_confirm: true,
    };
    if (data.password) authPatch.password = data.password;
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
      data.user_id,
      authPatch,
    );
    if (authErr) throw new Error(authErr.message);

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }
    return { ok: true };
  });

// Self: update own profile
export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(1).max(120),
        job_title: z.string().trim().max(120).nullable().optional(),
        department: z.string().trim().max(120).nullable().optional(),
        avatar_url: z.string().trim().max(2048).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        date_of_birth: z.string().nullable().optional(),
        gender: z.string().trim().max(40).nullable().optional(),
        address: z.string().trim().max(500).nullable().optional(),
        nationality: z.string().trim().max(80).nullable().optional(),
        emergency_contact_name: z.string().trim().max(120).nullable().optional(),
        emergency_contact_phone: z.string().trim().max(40).nullable().optional(),
        bio: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({
      full_name: data.full_name,
      job_title: data.job_title ?? null,
      department: data.department ?? null,
      avatar_url: data.avatar_url ?? null,
      phone: data.phone ?? null,
      date_of_birth: data.date_of_birth ?? null,
      gender: data.gender ?? null,
      address: data.address ?? null,
      nationality: data.nationality ?? null,
      emergency_contact_name: data.emergency_contact_name ?? null,
      emergency_contact_phone: data.emergency_contact_phone ?? null,
      bio: data.bio ?? null,
    } as never).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Get the signed-in user's profile + role (used to bootstrap the app)
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }, { data: sysAssign }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("*")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId),
      context.supabase
        .from("user_system_roles")
        .select("role_id")
        .eq("user_id", context.userId),
    ]);

    const roleIds = (sysAssign ?? []).map((r) => r.role_id);
    const systemModules: Record<string, "view" | "edit"> = {};
    let hasAdminSystemRole = false;
    if (roleIds.length > 0) {
      const { data: sr } = await context.supabase
        .from("system_roles")
        .select("modules,access_level")
        .in("id", roleIds);
      for (const r of sr ?? []) {
        const modules = (r.modules as string[] | null) ?? [];
        const level = (r.access_level as "view" | "edit") ?? "edit";
        for (const m of modules) {
          if (systemModules[m] !== "edit") systemModules[m] = level;
        }
        if (level === "edit" && modules.includes("admin")) {
          hasAdminSystemRole = true;
        }
      }
    }

    const isAdmin = !!roles?.some((r) => r.role === "admin") || hasAdminSystemRole;

    return {
      profile,
      roles: roles?.map((r) => r.role) ?? [],
      isAdmin,
      systemModules,
    };
  });

// Admin: bulk import staff (create or update)
export const adminBulkImportStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      rows: z.array(z.object({
        full_name: z.string().trim().min(1).max(120),
        username: z.string().trim().min(1).max(64),
        email: z.string().trim().email().max(255),
        job_title: z.string().trim().max(120).nullable().optional(),
        department: z.string().trim().max(120).nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        manager_email: z.string().trim().max(255).optional().nullable(),
        start_date: z.string().nullable().optional(),
      })).min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden: admin only");

    const { data: existing } = await supabaseAdmin.from("profiles").select("id,email");
    const byEmail = new Map((existing ?? []).map((p) => [p.email.toLowerCase(), p.id]));

    // First pass: create/update profiles
    let created = 0, updated = 0;
    const errors: { email: string; message: string }[] = [];
    const tempPasswords: { email: string; password: string }[] = [];

    for (const r of data.rows) {
      const email = r.email.toLowerCase();
      const username = r.username.toLowerCase();
      const start_date = r.start_date ? String(r.start_date).slice(0, 10) : null;

      try {
        const id = byEmail.get(email);
        if (id) {
          const { error } = await supabaseAdmin.from("profiles").update({
            full_name: r.full_name, username, job_title: r.job_title ?? null,
            department: r.department ?? null, status: r.status ?? "active",
            start_date,
          }).eq("id", id);
          if (error) throw error;
          updated++;
        } else {
          const password = Math.random().toString(36).slice(2, 10) + "Aa1!";
          const { data: cu, error: ce } = await supabaseAdmin.auth.admin.createUser({
            email: r.email, password, email_confirm: true,
            user_metadata: { username, full_name: r.full_name },
          });
          if (ce || !cu.user) throw new Error(ce?.message ?? "createUser failed");
          const { error: pe } = await supabaseAdmin.from("profiles").insert({
            id: cu.user.id, username, full_name: r.full_name, email: r.email,
            job_title: r.job_title ?? null, department: r.department ?? null,
            status: r.status ?? "active", start_date,
          });
          if (pe) { await supabaseAdmin.auth.admin.deleteUser(cu.user.id); throw pe; }
          await supabaseAdmin.from("user_roles").insert({ user_id: cu.user.id, role: "staff" });
          byEmail.set(email, cu.user.id);
          tempPasswords.push({ email: r.email, password });
          created++;
        }
      } catch (e: any) {
        errors.push({ email: r.email, message: e.message ?? String(e) });
      }
    }

    // Second pass: link managers (now all profiles exist)
    for (const r of data.rows) {
      const me = byEmail.get(r.email.toLowerCase());
      const mgr = r.manager_email ? byEmail.get(r.manager_email.toLowerCase()) ?? null : null;
      if (me) await supabaseAdmin.from("profiles").update({ manager_id: mgr }).eq("id", me);
    }

    return { created, updated, errors, tempPasswords };
  });
