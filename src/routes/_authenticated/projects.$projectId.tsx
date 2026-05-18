import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, Calendar, MessageSquare, Target, UserPlus, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STATUS_META, PRIORITY_META, metaEntries } from "@/lib/project-meta";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_milestones").select("*").eq("project_id", projectId)
        .order("order_index").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updates = useQuery({
    queryKey: ["project-updates", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_status_updates").select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,avatar_url,job_title").order("full_name")).data ?? [],
  });

  const canManage = useMemo(() => {
    if (!project.data || !profile) return false;
    if (isAdmin) return true;
    if (project.data.owner_id === profile.id) return true;
    return members.data?.some((m) => m.profile_id === profile.id && (m.role === "owner" || m.role === "manager")) ?? false;
  }, [project.data, profile, isAdmin, members.data]);

  const isMember = useMemo(() => {
    if (!profile || !project.data) return false;
    if (project.data.owner_id === profile.id) return true;
    return members.data?.some((m) => m.profile_id === profile.id) ?? false;
  }, [project.data, profile, members.data]);

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
      <div className="space-y-4">
        <Link to="/projects" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
        </Link>
        <Card className="p-10 text-center">
          <p className="text-sm">Project not found.</p>
        </Card>
      </div>
    );
  }

  const p = project.data;
  const status = STATUS_META[p.status] ?? STATUS_META.planning;
  const priority = PRIORITY_META[p.priority] ?? PRIORITY_META.normal;
  const owner = staff.data?.find((s) => s.id === p.owner_id);
  const memberProfiles = (members.data ?? []).map((m) => ({
    ...m,
    profile: staff.data?.find((s) => s.id === m.profile_id),
  }));

  const avgProgress = milestones.data && milestones.data.length > 0
    ? Math.round(milestones.data.reduce((sum, m) => sum + (m.progress ?? 0), 0) / milestones.data.length)
    : 0;

  const onDeleteProject = async () => {
    if (!confirm("Delete this project and all its data?")) return;
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    navigate({ to: "/projects" });
  };

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to projects
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={priority.variant}>{priority.label}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
          {p.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{p.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            {p.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Start {new Date(p.start_date).toLocaleDateString()}</span>}
            {p.due_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {new Date(p.due_date).toLocaleDateString()}</span>}
            {owner && <span>Owner · {owner.full_name}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <EditProjectDialog project={p} onSaved={() => qc.invalidateQueries({ queryKey: ["project", projectId] })} />
            <Button variant="ghost" size="icon" onClick={onDeleteProject} title="Delete project">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Overall progress</p>
          <p className="text-2xl font-semibold mt-1">{avgProgress}%</p>
          <Progress value={avgProgress} className="mt-2" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Milestones</p>
          <p className="text-2xl font-semibold mt-1">
            {milestones.data?.filter((m) => m.status === "completed").length ?? 0}
            <span className="text-sm text-muted-foreground"> / {milestones.data?.length ?? 0}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Team</p>
          <p className="text-2xl font-semibold mt-1">{(members.data?.length ?? 0) + 1}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Milestones */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Milestones</h2>
            {canManage && <NewMilestoneDialog projectId={projectId} onCreated={() => qc.invalidateQueries({ queryKey: ["project-milestones", projectId] })} />}
          </div>
          {(milestones.data ?? []).length === 0 ? (
            <Card className="p-6 border-dashed text-center">
              <p className="text-xs text-muted-foreground">No milestones yet.</p>
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

          {/* Status updates */}
          <div className="pt-4">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4" /> Status updates</h2>
            {(isMember || canManage) && (
              <NewStatusUpdate
                projectId={projectId}
                authorId={profile?.id ?? ""}
                onPosted={() => qc.invalidateQueries({ queryKey: ["project-updates", projectId] })}
              />
            )}
            <StatusUpdatesList
              updates={updates.data ?? []}
              staff={staff.data ?? []}
              currentUserId={profile?.id}
              canManage={canManage}
              onDeleted={() => qc.invalidateQueries({ queryKey: ["project-updates", projectId] })}
            />
          </div>
        </div>

        {/* Team panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Team</h2>
            {canManage && (
              <AddMemberDialog
                projectId={projectId}
                existingIds={[p.owner_id, ...(members.data ?? []).map((m) => m.profile_id)]}
                staff={staff.data ?? []}
                onAdded={() => qc.invalidateQueries({ queryKey: ["project-members", projectId] })}
              />
            )}
          </div>
          <Card className="p-3 space-y-2">
            {owner && (
              <div className="flex items-center gap-2 text-xs">
                <Avatar className="h-7 w-7">
                  {owner.avatar_url && <AvatarImage src={owner.avatar_url} />}
                  <AvatarFallback className="text-[10px]">{owner.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{owner.full_name}</p>
                  <p className="text-muted-foreground text-[11px]">Owner</p>
                </div>
              </div>
            )}
            {memberProfiles.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <Avatar className="h-7 w-7">
                  {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                  <AvatarFallback className="text-[10px]">{(m.profile?.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.profile?.full_name ?? "Unknown"}</p>
                  <p className="text-muted-foreground text-[11px] capitalize">{m.role}</p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                    await supabase.from("project_members").delete().eq("id", m.id);
                    qc.invalidateQueries({ queryKey: ["project-members", projectId] });
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {memberProfiles.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">No additional members</p>
            )}
          </Card>
        </div>
      </div>
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
          {milestone.due_date && <p className="text-[11px] text-muted-foreground mt-1">Due {new Date(milestone.due_date).toLocaleDateString()}</p>}
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
            type="number"
            min={0}
            max={100}
            value={progress}
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
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" /> Milestone</Button></DialogTrigger>
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
      <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add</Button></DialogTrigger>
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

function NewStatusUpdate({ projectId, authorId, onPosted }: { projectId: string; authorId: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!body.trim() || !authorId) return;
      setSubmitting(true);
      const { error } = await supabase.from("project_status_updates").insert({
        project_id: projectId, author_id: authorId, body, status: status ?? null,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      setBody(""); setStatus(undefined);
      onPosted();
    }} className="space-y-2">
      <Textarea placeholder="Post a status update…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} />
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Status (optional)" /></SelectTrigger>
          <SelectContent>
            {metaEntries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !body.trim()}>Post</Button>
      </div>
    </form>
  );
}

function EditProjectDialog({ project, onSaved }: {
  project: { id: string; name: string; description: string | null; status: string; priority: string; start_date: string | null; due_date: string | null };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [start, setStart] = useState(project.start_date ?? "");
  const [due, setDue] = useState(project.due_date ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("projects").update({
            name, description: desc || null, status, priority,
            start_date: start || null, due_date: due || null,
          }).eq("id", project.id);
          if (error) return toast.error(error.message);
          toast.success("Saved");
          setOpen(false);
          onSaved();
        }} className="space-y-4">
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
          </div>
          <DialogFooter><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type StatusUpdate = {
  id: string;
  author_id: string;
  body: string;
  status: string | null;
  created_at: string;
};
type StaffMin = { id: string; full_name: string; avatar_url: string | null; job_title: string | null };

function StatusUpdatesList({ updates, staff, currentUserId, canManage, onDeleted }: {
  updates: StatusUpdate[];
  staff: StaffMin[];
  currentUserId: string | undefined;
  canManage: boolean;
  onDeleted: () => void;
}) {
  const [query, setQuery] = useState("");
  const [authorId, setAuthorId] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const authorOptions = useMemo(() => {
    const ids = Array.from(new Set(updates.map((u) => u.author_id)));
    return ids.map((id) => ({ id, name: staff.find((s) => s.id === id)?.full_name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [updates, staff]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return updates.filter((u) => {
      if (authorId && u.author_id !== authorId) return false;
      const ts = new Date(u.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (q) {
        const author = staff.find((s) => s.id === u.author_id)?.full_name?.toLowerCase() ?? "";
        if (!u.body.toLowerCase().includes(q) && !author.includes(q)) return false;
      }
      return true;
    });
  }, [updates, query, authorId, fromDate, toDate, staff]);

  const hasFilters = !!(query || authorId || fromDate || toDate);

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search updates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={authorId} onValueChange={(v) => setAuthorId(v || undefined)}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-44"><SelectValue placeholder="All authors" /></SelectTrigger>
          <SelectContent>
            {authorOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 text-xs w-full sm:w-36" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 text-xs w-full sm:w-36" />
      </div>
      {hasFilters && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{filtered.length} of {updates.length} update{updates.length === 1 ? "" : "s"}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
            onClick={() => { setQuery(""); setAuthorId(undefined); setFromDate(""); setToDate(""); }}>
            <X className="h-3 w-3 mr-1" /> Clear filters
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {updates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">No updates yet</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">No updates match your filters</p>
        ) : filtered.map((u) => {
          const author = staff.find((s) => s.id === u.author_id);
          const canDelete = u.author_id === currentUserId || canManage;
          return (
            <Card key={u.id} className="p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-7 w-7">
                  {author?.avatar_url && <AvatarImage src={author.avatar_url} />}
                  <AvatarFallback className="text-xs">{(author?.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{author?.full_name ?? "Unknown"}</span>
                    {u.status && <Badge variant="outline" className="text-[10px]">{STATUS_META[u.status]?.label ?? u.status}</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(u.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{u.body}</p>
                </div>
                {canDelete && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
                    await supabase.from("project_status_updates").delete().eq("id", u.id);
                    onDeleted();
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
