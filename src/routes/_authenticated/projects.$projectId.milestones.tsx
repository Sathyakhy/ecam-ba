import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Target, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type Milestone = {
  id: string; title: string; description: string | null; due_date: string | null;
  progress: number; status: string; phase: string | null; remark: string | null;
};
type MilestoneItem = {
  id: string; milestone_id: string; project_id: string;
  title: string; description: string | null; remark: string | null;
  due_date: string | null; status: string; progress: number; order_index: number;
};

function MilestonesPage() {
  const { projectId } = Route.useParams();
  const { canManage, isMember } = useProject(projectId);
  const qc = useQueryClient();
  const canEdit = canManage || isMember;

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_milestones").select("*")
        .eq("project_id", projectId).order("order_index").order("created_at");
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const items = useQuery({
    queryKey: ["project-milestone-items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_milestone_items").select("*")
        .eq("project_id", projectId).order("order_index").order("created_at");
      if (error) throw error;
      return (data ?? []) as MilestoneItem[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
    qc.invalidateQueries({ queryKey: ["project-milestone-items", projectId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Milestones</h2>
        {canManage && <NewMilestoneDialog projectId={projectId} nextIndex={(milestones.data?.length ?? 0) + 1} onCreated={refresh} />}
      </div>
      {(milestones.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <p className="text-sm text-muted-foreground">No milestones yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(milestones.data ?? []).map((m) => (
            <PhaseCard
              key={m.id}
              milestone={m}
              items={(items.data ?? []).filter((i) => i.milestone_id === m.id)}
              projectId={projectId}
              canEdit={canEdit}
              canDelete={canManage}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseCard({ milestone, items, projectId, canEdit, canDelete, onChanged }: {
  milestone: Milestone;
  items: MilestoneItem[];
  projectId: string;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(true);

  const updateMilestone = async (patch: Partial<Milestone>) => {
    const { error } = await supabase.from("project_milestones").update(patch).eq("id", milestone.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary/5 border-b p-3 flex items-start gap-3">
        <button onClick={() => setOpen(!open)} className="mt-0.5 text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {milestone.phase && <Badge variant="secondary" className="text-[10px]">{milestone.phase}</Badge>}
            <p className="text-sm font-semibold">{milestone.title}</p>
          </div>
          {milestone.description && <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
            {milestone.due_date && <span>Due {formatDate(milestone.due_date)}</span>}
            {milestone.remark && <span>· {milestone.remark}</span>}
          </div>
        </div>
        {canEdit && (
          <Select value={milestone.status} onValueChange={(v) => updateMilestone({ status: v, progress: v === "completed" ? 100 : milestone.progress })}>
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
            if (!confirm("Delete this phase and all its items?")) return;
            await supabase.from("project_milestones").delete().eq("id", milestone.id);
            onChanged();
          }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>

      {open && (
        <div className="divide-y">
          {items.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground text-center">No items yet.</p>
          ) : items.map((it) => (
            <ItemRow key={it.id} item={it} canEdit={canEdit} canDelete={canDelete} onChanged={onChanged} />
          ))}
          {canEdit && (
            <div className="p-2">
              <NewItemDialog projectId={projectId} milestoneId={milestone.id} nextIndex={items.length + 1} onCreated={onChanged} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ItemRow({ item, canEdit, canDelete, onChanged }: {
  item: MilestoneItem; canEdit: boolean; canDelete: boolean; onChanged: () => void;
}) {
  const [progress, setProgress] = useState(item.progress);

  const update = async (patch: Partial<MilestoneItem>) => {
    const { error } = await supabase.from("project_milestone_items").update(patch).eq("id", item.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <div className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground">
            {item.due_date && <span>Due {formatDate(item.due_date)}</span>}
            {item.remark && <span>Remark: {item.remark}</span>}
          </div>
        </div>
        {canEdit && (
          <Select value={item.status} onValueChange={(v) => update({ status: v, progress: v === "completed" ? 100 : item.progress })}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
            await supabase.from("project_milestone_items").delete().eq("id", item.id);
            onChanged();
          }}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Progress value={progress} className="flex-1 h-1.5" />
        {canEdit ? (
          <Input type="number" min={0} max={100} value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onBlur={() => progress !== item.progress && update({ progress })}
            className="h-7 w-16 text-xs"
          />
        ) : (
          <span className="text-xs text-muted-foreground w-10 text-right">{progress}%</span>
        )}
      </div>
    </div>
  );
}

function NewMilestoneDialog({ projectId, nextIndex, onCreated }: { projectId: string; nextIndex: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(`Phase ${nextIndex}`);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [remark, setRemark] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setPhase(`Phase ${nextIndex}`); }}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Phase</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New phase</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("project_milestones").insert({
            project_id: projectId, title, description: desc || null, due_date: due || null,
            phase: phase || null, remark: remark || null, order_index: nextIndex,
          });
          if (error) return toast.error(error.message);
          toast.success("Phase added");
          setOpen(false); setTitle(""); setDesc(""); setDue(""); setRemark("");
          onCreated();
        }} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2"><Label>Phase</Label><Input value={phase} onChange={(e) => setPhase(e.target.value)} maxLength={50} /></div>
            <div className="space-y-2 col-span-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={1000} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div className="space-y-2"><Label>Remark</Label><Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={200} /></div>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewItemDialog({ projectId, milestoneId, nextIndex, onCreated }: { projectId: string; milestoneId: string; nextIndex: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [remark, setRemark] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="w-full justify-start text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New milestone item</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("project_milestone_items").insert({
            project_id: projectId, milestone_id: milestoneId,
            title, description: desc || null, due_date: due || null,
            remark: remark || null, order_index: nextIndex,
          });
          if (error) return toast.error(error.message);
          toast.success("Item added");
          setOpen(false); setTitle(""); setDesc(""); setDue(""); setRemark("");
          onCreated();
        }} className="space-y-3">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={1000} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div className="space-y-2"><Label>Remark</Label><Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={200} /></div>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
