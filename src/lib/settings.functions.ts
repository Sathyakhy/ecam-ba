import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAppSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle();
  return {
    settings: data ?? {
      id: 1,
      app_name: "Department OS",
      tagline: "Internal workspace",
      hero_title: "Onboarding, learning, and team operations.",
      hero_description:
        "A single internal workspace to onboard new staff, run training, track tasks and keep your department coordinated.",
      logo_url: null,
    },
  };
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        app_name: z.string().trim().min(1).max(60),
        tagline: z.string().trim().min(1).max(120),
        hero_title: z.string().trim().min(1).max(200),
        hero_description: z.string().trim().min(1).max(600),
        logo_url: z.string().trim().max(2048).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden: admin only");

    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({
        app_name: data.app_name,
        tagline: data.tagline,
        hero_title: data.hero_title,
        hero_description: data.hero_description,
        logo_url: data.logo_url ?? null,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
