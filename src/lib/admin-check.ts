import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the user is admin either via user_roles.role='admin'
 * or via a system_role assignment with access_level='edit' and modules containing 'admin'.
 * Mirrors the DB function private.has_role.
 */
export async function isUserAdmin(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<boolean> {
  const [{ data: roles }, { data: sysAssign }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("user_system_roles").select("role_id").eq("user_id", userId),
  ]);
  if (roles?.some((r: { role: string }) => r.role === "admin")) return true;

  const roleIds = (sysAssign ?? []).map((r: { role_id: string }) => r.role_id);
  if (roleIds.length === 0) return false;

  const { data: sr } = await supabase
    .from("system_roles")
    .select("modules,access_level")
    .in("id", roleIds);
  return (sr ?? []).some(
    (r: { modules: string[] | null; access_level: string }) =>
      r.access_level === "edit" && (r.modules ?? []).includes("admin"),
  );
}

export async function assertAdmin(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<void> {
  if (!(await isUserAdmin(supabase, userId))) {
    throw new Error("Forbidden: admin only");
  }
}
