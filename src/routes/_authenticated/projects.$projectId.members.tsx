import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Trash2, Tag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";

export const Route = createFileRoute("/_authenticated/projects/$projectId/members")({
  component: MembersPage,
});

function MembersPage() {
  const { projectId } = Route.useParams();
  const { project, members, staff, canManage } = useProject(projectId);
  const qc = useQueryClient();

  const rolesCatalog = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () => (await supabase.from("project_roles_catalog").select("*").order("name")).data ?? [],
  });
  const memberRoles = useQuery({
    queryKey: ["project_member_roles", projectId],
    queryFn: async () => (await supabase.from("project_member_roles").select("*").eq("project_id", projectId)).data ?? [],
  });

  if (!project.data) return null;
  const p = project.data;
  const owner = staff.data?.find((s) => s.id === p.owner_id);
  const manager = staff.data?.find((s) => s.id === p.manager_id);

  const rows = (members.data ?? []).map((m) => ({
    ...m,
    profile: staff.data?.find((s) => s.id === m.profile_id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Team members</h2>
        {canManage && (
          <AddMemberDialog
            projectId={projectId}
            existingIds={[p.owner_id, p.manager_id, ...(members.data ?? []).map((m) => m.profile_id)].filter(Boolean) as string[]}
            staff={staff.data ?? []}
            onAdded={() => qc.invalidateQueries({ queryKey: ["project-members", projectId] })}
          />
        )}
      </div>

      <Card className="divide-y">
        <MemberRow profile={owner} role="Owner" />
        {manager && manager.id !== owner?.id && <MemberRow profile={manager} role="Primary PM" />}
        {rows.map((m) => (
          <MemberRow
            key={m.id}
            profile={m.profile}
            role={m.role}
            roleSlot={
              <ProjectRoleSlot
                projectId={projectId}
                memberId={m.id}
                catalog={rolesCatalog.data ?? []}
                assigned={(memberRoles.data ?? []).filter((mr) => mr.project_member_id === m.id)}
                canManage={canManage}
                onChange={() => qc.invalidateQueries({ queryKey: ["project_member_roles", projectId] })}
              />
            }
            onRemove={canManage ? async () => {
              await supabase.from("project_members").delete().eq("id", m.id);
              qc.invalidateQueries({ queryKey: ["project-members", projectId] });
            } : undefined}
          />
        ))}
        {rows.length === 0 && !manager && (
          <p className="text-xs text-muted-foreground p-4 text-center">No additional members yet.</p>
        )}
      </Card>
    </div>
  );
}

function MemberRow({ profile, role, roleSlot, onRemove }: {
  profile?: { id: string; full_name: string; avatar_url: string | null; job_title: string | null };
  role: string;
  roleSlot?: React.ReactNode;
  onRemove?: () => void | Promise<void>;
}) {
  if (!profile) return null;
  return (
    <div className="flex items-center gap-3 p-3 flex-wrap">
      <Avatar className="h-9 w-9">
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
        <AvatarFallback>{profile.full_name.slice(0,2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">{profile.job_title ?? ""}</p>
      </div>
      <span className="text-xs text-muted-foreground capitalize">{role}</span>
      {roleSlot}
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove()}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function ProjectRoleSlot({ projectId, memberId, catalog, assigned, canManage, onChange }: {
  projectId: string;
  memberId: string;
  catalog: { id: string; name: string }[];
  assigned: { id: string; role_id: string; project_member_id: string }[];
  canManage: boolean;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string | undefined>();
  const available = catalog.filter((c) => !assigned.some((a) => a.role_id === c.id));

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("project_member_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };
  const addRole = async () => {
    if (!pick) return;
    const { error } = await supabase.from("project_member_roles").insert({
      project_id: projectId, project_member_id: memberId, role_id: pick,
    });
    if (error) return toast.error(error.message);
    setPick(undefined); setAdding(false); onChange();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assigned.map((a) => {
        const r = catalog.find((c) => c.id === a.role_id);
        if (!r) return null;
        return (
          <Badge key={a.id} variant="secondary" className="gap-1 text-[10px]">
            <Tag className="h-2.5 w-2.5" />{r.name}
            {canManage && <button type="button" onClick={() => removeRole(a.id)} className="hover:text-destructive ml-0.5"><X className="h-2.5 w-2.5" /></button>}
          </Badge>
        );
      })}
      {canManage && (adding ? (
        <div className="flex items-center gap-1">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              {available.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addRole}><Plus className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setAdding(false); setPick(undefined); }}><X className="h-3 w-3" /></Button>
        </div>
      ) : available.length > 0 && (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 mr-0.5" /> Role
        </Button>
      ))}
    </div>
  );
}

function AddMemberDialog({ projectId, staff, existingIds, onAdded }: {
  projectId: string;
  staff: { id: string; full_name: string }[];
  existingIds: string[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState<string | undefined>(undefined);
  const [roleName, setRoleName] = useState<string | undefined>(undefined);
  const available = staff.filter((s) => !existingIds.includes(s.id));

  const rolesCatalog = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () =>
      (await supabase.from("project_roles_catalog").select("id,name,access_level").order("name")).data ?? [],
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!pid || !roleName) return;
          const { error } = await supabase.from("project_members").insert({ project_id: projectId, profile_id: pid, role: roleName });
          if (error) return toast.error(error.message);
          toast.success("Member added");
          setOpen(false); setPid(undefined); setRoleName(undefined);
          onAdded();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {available.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Access</Label>
            <Select value={roleName} onValueChange={setRoleName}>
              <SelectTrigger><SelectValue placeholder="Select role from Project Config" /></SelectTrigger>
              <SelectContent>
                {(rolesCatalog.data ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No roles yet. Add some in Project Config → Roles.</div>
                ) : (
                  (rolesCatalog.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name} <span className="text-muted-foreground">({r.access_level === "view" ? "View" : "Edit"})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit" disabled={!pid || !roleName}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
