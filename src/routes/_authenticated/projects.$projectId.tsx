import { createFileRoute, Outlet, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Pencil, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATUS_META, PRIORITY_META, metaEntries } from "@/lib/project-meta";
import { ProjectHeader } from "@/components/project/project-header";
import { useProject } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { project, canManage } = useProject(projectId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (project.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading project…</p>;
  }
  if (project.error) {
    return (
      <Card className="p-6 border-destructive/40">
        <p className="text-sm text-destructive">{(project.error as Error).message}</p>
      </Card>
    );
  }
  if (!project.data) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm">Project not found.</p>
      </Card>
    );
  }

  const onDelete = async () => {
    if (!confirm("Delete this project and all its data?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    navigate({ to: "/projects" });
  };

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project.data}
        right={canManage && (
          <div className="flex items-center gap-2">
            <EditProjectDialog
              project={project.data}
              onSaved={() => qc.invalidateQueries({ queryKey: ["project", projectId] })}
            />
            <Button variant="ghost" size="icon" onClick={onDelete} title="Delete project">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />
      <Outlet />
    </div>
  );
}

function EditProjectDialog({ project, onSaved }: {
  project: {
    id: string; name: string; description: string | null; status: string; priority: string;
    start_date: string | null; due_date: string | null;
    customer_id: string | null; manager_id: string | null; owner_id: string;
  };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [start, setStart] = useState(project.start_date ?? "");
  const [due, setDue] = useState(project.due_date ?? "");
  const [customerId, setCustomerId] = useState<string | undefined>(project.customer_id ?? undefined);
  const [managerId, setManagerId] = useState<string | undefined>(project.manager_id ?? undefined);

  const customers = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id,name").order("name")).data ?? [],
    enabled: open,
  });
  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("projects").update({
              name, description: desc || null, status, priority,
              start_date: start || null, due_date: due || null,
              customer_id: customerId ?? null,
              manager_id: managerId ?? null,
            }).eq("id", project.id);
            if (error) return toast.error(error.message);
            toast.success("Saved");
            setOpen(false);
            onSaved();
          }}
          className="space-y-4"
        >
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metaEntries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metaEntries(PRIORITY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project manager</Label>
              <Select value={managerId} onValueChange={(v) => setManagerId(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
