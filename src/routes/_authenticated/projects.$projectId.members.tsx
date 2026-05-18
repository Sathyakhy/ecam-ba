import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
        {manager && manager.id !== owner?.id && <MemberRow profile={manager} role="Project manager" />}
        {rows.map((m) => (
          <MemberRow
            key={m.id}
            profile={m.profile}
            role={m.role}
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

function MemberRow({ profile, role, onRemove }: {
  profile?: { id: string; full_name: string; avatar_url: string | null; job_title: string | null };
  role: string;
  onRemove?: () => void | Promise<void>;
}) {
  if (!profile) return null;
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar className="h-9 w-9">
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
        <AvatarFallback>{profile.full_name.slice(0,2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">{profile.job_title ?? ""}</p>
      </div>
      <span className="text-xs text-muted-foreground capitalize">{role}</span>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove()}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
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
  const [role, setRole] = useState("member");
  const available = staff.filter((s) => !existingIds.includes(s.id));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add member</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!pid) return;
          const { error } = await supabase.from("project_members").insert({ project_id: projectId, profile_id: pid, role });
          if (error) return toast.error(error.message);
          toast.success("Member added");
          setOpen(false); setPid(undefined); setRole("member");
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
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
