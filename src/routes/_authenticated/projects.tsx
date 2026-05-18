import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, FolderKanban, Calendar, Users, Search } from "lucide-react";
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
import { STATUS_META, PRIORITY_META, metaEntries } from "@/lib/project-meta";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsIndex,
});

export function ProjectsIndex() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  if (pathname !== "/projects" && pathname !== "/projects/") {
    return <Outlet />;
  }

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
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

  const milestoneProgress = useQuery({
    queryKey: ["projects-progress"],
    queryFn: async () => {
      const { data } = await supabase.from("project_milestones").select("project_id,progress");
      const buckets: Record<string, number[]> = {};
      (data ?? []).forEach((m) => { (buckets[m.project_id] ??= []).push(m.progress ?? 0); });
      const avg: Record<string, number> = {};
      Object.entries(buckets).forEach(([k, v]) => { avg[k] = Math.round(v.reduce((a,b)=>a+b,0) / v.length); });
      return avg;
    },
  });

  const customers = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id,name").order("name")).data ?? [],
  });

  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,avatar_url").order("full_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects.data ?? []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (customerFilter !== "all" && p.customer_id !== customerFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects.data, statusFilter, customerFilter, query]);

  const stats = useMemo(() => {
    const all = projects.data ?? [];
    const today = new Date();
    return {
      total: all.length,
      active: all.filter((p) => p.status === "active").length,
      completed: all.filter((p) => p.status === "completed").length,
      overdue: all.filter((p) => p.due_date && p.status !== "completed" && new Date(p.due_date) < today).length,
    };
  }, [projects.data]);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Plan, execute and monitor department initiatives."
        actions={
          <NewProjectDialog
            ownerId={profile?.id ?? ""}
            onCreated={(id) => {
              qc.invalidateQueries({ queryKey: ["projects"] });
              if (id) navigate({ to: "/projects/$projectId", params: { projectId: id } });
            }}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-4 mb-5">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold">{stats.total}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-semibold">{stats.active}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-semibold">{stats.completed}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-xl font-semibold text-destructive">{stats.overdue}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-7" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {metaEntries(STATUS_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {projects.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No projects {(projects.data ?? []).length === 0 ? "yet" : "match"}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const owner = staff.data?.find((o) => o.id === p.owner_id);
            const manager = staff.data?.find((o) => o.id === p.manager_id);
            const customer = customers.data?.find((c) => c.id === p.customer_id);
            const memberCount = members.data?.[p.id] ?? 0;
            const status = STATUS_META[p.status] ?? STATUS_META.planning;
            const priority = PRIORITY_META[p.priority] ?? PRIORITY_META.normal;
            const progress = milestoneProgress.data?.[p.id] ?? 0;
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
                {customer && <p className="text-[11px] text-muted-foreground mb-1">For {customer.name}</p>}
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                )}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span><span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {memberCount + 1}</span>
                    {p.due_date && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(p.due_date).toLocaleDateString()}</span>
                    )}
                  </div>
                  <Badge variant={priority.variant} className="text-[10px]">{priority.label}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3 truncate">
                  {manager ? `PM · ${manager.full_name}` : owner ? `Owner · ${owner.full_name}` : ""}
                </p>
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
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [managerId, setManagerId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

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
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New project</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!ownerId) return toast.error("Missing profile");
          setSubmitting(true);
          const { data, error } = await supabase.from("projects").insert({
            name, description: desc || null, status, priority,
            start_date: start || null, due_date: due || null,
            owner_id: ownerId, created_by: ownerId,
            customer_id: customerId ?? null, manager_id: managerId ?? null,
          }).select("id").single();
          setSubmitting(false);
          if (error) return toast.error(error.message);
          toast.success("Project created");
          setOpen(false); setName(""); setDesc(""); setStart(""); setDue("");
          setStatus("planning"); setPriority("normal");
          setCustomerId(undefined); setManagerId(undefined);
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
          <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
