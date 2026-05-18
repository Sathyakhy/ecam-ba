import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, FolderKanban, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { STATUS_META, PRIORITY_META } from "@/lib/project-meta";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsIndex,
});

export function ProjectsIndex() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const projects = useQuery({
    queryKey: ["projects", statusFilter],
    queryFn: async () => {
      let q = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["projects-member-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("project_id");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((m) => { counts[m.project_id] = (counts[m.project_id] ?? 0) + 1; });
      return counts;
    },
  });

  const owners = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,avatar_url").order("full_name")).data ?? [],
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Plan and track department initiatives, milestones and ownership."
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NewProjectDialog
              onCreated={(id) => {
                qc.invalidateQueries({ queryKey: ["projects"] });
                if (id) navigate({ to: "/projects/$projectId", params: { projectId: id } });
              }}
              ownerId={profile?.id ?? ""}
            />
          </>
        }
      />

      {projects.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.error ? (
        <Card className="p-6 border-destructive/40">
          <p className="text-sm text-destructive">{(projects.error as Error).message}</p>
        </Card>
      ) : (projects.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create one to start tracking work.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects.data ?? []).map((p) => {
            const owner = owners.data?.find((o) => o.id === p.owner_id);
            const memberCount = members.data?.[p.id] ?? 0;
            const status = STATUS_META[p.status] ?? STATUS_META.planning;
            const priority = PRIORITY_META[p.priority] ?? PRIORITY_META.normal;
            return (
              <Card
                key={p.id}
                className="p-5 hover:border-primary/40 hover:shadow-sm transition cursor-pointer"
                onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm line-clamp-2 flex-1">{p.name}</h3>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-4">{p.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {memberCount + 1}</span>
                    {p.due_date && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(p.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Badge variant={priority.variant} className="text-[10px]">{priority.label}</Badge>
                </div>
                {owner && (
                  <p className="text-[11px] text-muted-foreground mt-3 truncate">Owner · {owner.full_name}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({ ownerId, onCreated }: { ownerId: string; onCreated: (id?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("planning");
  const [priority, setPriority] = useState("normal");
  const [start, setStart] = useState("");
  const [due, setDue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New project</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Missing profile");
          setSubmitting(true);
          const { data, error } = await supabase.from("projects").insert({
            name, description: desc || null, status, priority,
            start_date: start || null, due_date: due || null,
            owner_id: ownerId, created_by: ownerId,
          }).select("id").single();
          setSubmitting(false);
          if (error) return toast.error(error.message);
          toast.success("Project created");
          setOpen(false); setName(""); setDesc(""); setStart(""); setDue("");
          setStatus("planning"); setPriority("normal");
          onCreated(data?.id);
        }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
