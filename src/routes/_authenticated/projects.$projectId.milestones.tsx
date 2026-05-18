import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";
import { formatDate } from "@/lib/project-meta";

export const Route = createFileRoute("/_authenticated/projects/$projectId/milestones")({
  component: MilestonesPage,
});

function MilestonesPage() {
  const { projectId } = Route.useParams();
  const { canManage, isMember } = useProject(projectId);
  const qc = useQueryClient();

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_milestones").select("*").eq("project_id", projectId)
        .order("order_index").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Milestones</h2>
        {canManage && <NewMilestoneDialog projectId={projectId} onCreated={() => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] })} />}
      </div>
      {(milestones.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <p className="text-sm text-muted-foreground">No milestones yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(milestones.data ?? []).map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              canEdit={canManage || isMember}
              canDelete={canManage}
              onChanged={() => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRow({ milestone, canEdit, canDelete, onChanged }: {
  milestone: { id: string; title: string; description: string | null; due_date: string | null; progress: number; status: string };
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [progress, setProgress] = useState(milestone.progress);
  const [status, setStatus] = useState(milestone.status);

  const save = async (next: { progress?: number; status?: string }) => {
    const payload: { progress?: number; status?: string } = { ...next };
    if (next.progress !== undefined && next.progress >= 100) payload.status = "completed";
    if (next.status === "completed" && progress < 100) payload.progress = 100;
    const { error } = await supabase.from("project_milestones").update(payload).eq("id", milestone.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{milestone.title}</p>
          {milestone.description && <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>}
          {milestone.due_date && <p className="text-[11px] text-muted-foreground mt-1">Due {formatDate(milestone.due_date)}</p>}
        </div>
        {canEdit && (
          <Select value={status} onValueChange={(v) => { setStatus(v); save({ status: v }); }}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
            await supabase.from("project_milestones").delete().eq("id", milestone.id);
            onChanged();
          }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress} className="flex-1" />
        {canEdit ? (
          <Input
            type="number" min={0} max={100} value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onBlur={() => progress !== milestone.progress && save({ progress })}
            className="h-7 w-16 text-xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
        )}
      </div>
    </Card>
  );
}

function NewMilestoneDialog({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Milestone</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New milestone</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("project_milestones").insert({
            project_id: projectId, title, description: desc || null, due_date: due || null,
          });
          if (error) return toast.error(error.message);
          toast.success("Milestone added");
          setOpen(false); setTitle(""); setDesc(""); setDue("");
          onCreated();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={1000} /></div>
          <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
