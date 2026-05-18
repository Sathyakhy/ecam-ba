import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useProject(projectId: string) {
  const { profile, isAdmin } = useAuth();

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,avatar_url,job_title").order("full_name")).data ?? [],
  });

  const rolesCatalog = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () =>
      (await supabase.from("project_roles_catalog").select("name,access_level")).data ?? [],
  });

  const canManage = useMemo(() => {
    if (!project.data || !profile) return false;
    if (isAdmin) return true;
    if (project.data.owner_id === profile.id) return true;
    if (project.data.manager_id === profile.id) return true;
    const myMembership = members.data?.find((m) => m.profile_id === profile.id);
    if (!myMembership) return false;
    // Legacy/builtin access values
    if (myMembership.role === "owner" || myMembership.role === "manager") return true;
    // Role from project_roles_catalog: managers if marked editable
    const entry = rolesCatalog.data?.find((r) => r.name === myMembership.role);
    return entry?.access_level === "edit";
  }, [project.data, profile, isAdmin, members.data, rolesCatalog.data]);

  const isMember = useMemo(() => {
    if (!profile || !project.data) return false;
    if (project.data.owner_id === profile.id) return true;
    if (project.data.manager_id === profile.id) return true;
    return members.data?.some((m) => m.profile_id === profile.id) ?? false;
  }, [project.data, profile, members.data]);

  return { project, members, staff, canManage, isMember, profile, isAdmin };
}

export type StaffMin = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
};
