import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, FolderKanban, Calendar, Users, Search, Bookmark, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { STATUS_META, PRIORITY_META, metaEntries } from "@/lib/project-meta";
import { instantiateTemplate } from "@/lib/project-templates";

type Filters = {
  q: string;
  status: string;
  priority: string;
  customer: string;
  manager: string;
  overdue: boolean;
  archived: boolean;
};
const DEFAULT_FILTERS: Filters = {
  q: "", status: "all", priority: "all", customer: "all", manager: "all",
  overdue: false, archived: false,
};

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/projects" && pathname !== "/projects/") {
    return <Outlet />;
  }

  return <ProjectsList />;
}

function ProjectsList() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setActiveViewId(null);
  };

  const projects = useQuery({
    queryKey: ["projects", filters.archived],
    queryFn: async () => {
      const q = supabase.from("projects").select("*").order("created_at", { ascending: false });
      const { data, error } = filters.archived
        ? await q.not("deleted_at", "is", null)
        : await q.is("deleted_at", null);
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
      const { data } = await supabase.from("project_milestones").select("project_id,progress").is("deleted_at", null);
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

  const savedViews = useQuery({
    queryKey: ["project-saved-views", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_saved_views")
        .select("id,name,filters,is_shared,user_id")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const applyView = (id: string) => {
    const v = savedViews.data?.find((x) => x.id === id);
    if (!v) return;
    setFilters({ ...DEFAULT_FILTERS, ...(v.filters as Partial<Filters>) });
    setActiveViewId(id);
  };

  const saveView = async (name: string, shared: boolean) => {
    if (!profile?.id || !name.trim()) return;
    const { data, error } = await supabase.from("project_saved_views").insert({
      user_id: profile.id, name: name.trim(), filters, is_shared: shared,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("View saved");
    setActiveViewId(data?.id ?? null);
    qc.invalidateQueries({ queryKey: ["project-saved-views"] });
  };

  const deleteView = async (id: string) => {
    if (!confirm("Delete this saved view?")) return;
    const { error } = await supabase.from("project_saved_views").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeViewId === id) setActiveViewId(null);
    qc.invalidateQueries({ queryKey: ["project-saved-views"] });
  };

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const today = new Date();
    return (projects.data ?? []).filter((p) => {
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.priority !== "all" && p.priority !== filters.priority) return false;
      if (filters.customer !== "all" && p.customer_id !== filters.customer) return false;
      if (filters.manager !== "all" && p.manager_id !== filters.manager) return false;
      if (filters.overdue && !(p.due_date && p.status !== "completed" && new Date(p.due_date) < today)) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects.data, filters]);

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

  const activeFilterCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.customer !== "all" ? 1 : 0) +
    (filters.manager !== "all" ? 1 : 0) +
    (filters.overdue ? 1 : 0) +
    (filters.archived ? 1 : 0) +
    (filters.q ? 1 : 0);

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

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search projects…" value={filters.q} onChange={(e) => setF("q", e.target.value)} className="h-9 pl-7" />
        </div>
        <Select value={filters.status} onValueChange={(v) => setF("status", v)}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {metaEntries(STATUS_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => setF("priority", v)}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {metaEntries(PRIORITY_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.customer} onValueChange={(v) => setF("customer", v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.manager} onValueChange={(v) => setF("manager", v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All PMs</SelectItem>
            {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs px-2 h-9 rounded-md border cursor-pointer">
          <Switch checked={filters.overdue} onCheckedChange={(v) => setF("overdue", v)} />
          Overdue
        </label>
        <label className="flex items-center gap-1.5 text-xs px-2 h-9 rounded-md border cursor-pointer">
          <Switch checked={filters.archived} onCheckedChange={(v) => setF("archived", v)} />
          Archived
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Bookmark className="h-3.5 w-3.5 mr-1" />
              {activeViewId ? (savedViews.data?.find((v) => v.id === activeViewId)?.name ?? "Views") : "Views"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs">Saved views</DropdownMenuLabel>
            {(savedViews.data ?? []).length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No saved views yet.</p>
            ) : (
              (savedViews.data ?? []).map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  className="text-xs flex items-center justify-between gap-2"
                  onSelect={(e) => { e.preventDefault(); applyView(v.id); }}
                >
                  <span className="truncate">
                    {v.name}{v.is_shared && <span className="ml-1 text-muted-foreground">· shared</span>}
                  </span>
                  {v.user_id === profile?.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                      className="text-destructive opacity-70 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <SaveViewMenuItem onSave={saveView} disabled={activeFilterCount === 0} />
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilters(DEFAULT_FILTERS); setActiveViewId(null); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
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
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="p-5 hover:border-primary/40 hover:shadow-sm transition cursor-pointer h-full">
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SaveViewMenuItem({ onSave, disabled }: { onSave: (name: string, shared: boolean) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  if (!editing) {
    return (
      <DropdownMenuItem
        disabled={disabled}
        className="text-xs"
        onSelect={(e) => { e.preventDefault(); setEditing(true); }}
      >
        <Save className="h-3 w-3 mr-1.5" /> Save current filters as view
      </DropdownMenuItem>
    );
  }
  return (
    <div className="p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input autoFocus placeholder="View name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" maxLength={60} />
      <label className="flex items-center gap-2 text-[11px]">
        <Switch checked={shared} onCheckedChange={setShared} /> Share with team
      </label>
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setName(""); }}>Cancel</Button>
        <Button type="button" size="sm" className="h-7 text-xs" disabled={!name.trim()} onClick={() => { onSave(name, shared); setEditing(false); setName(""); setShared(false); }}>Save</Button>
      </div>
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
  const [vendorId, setVendorId] = useState<string | undefined>();
  const [productId, setProductId] = useState<string | undefined>();
  const [managerId, setManagerId] = useState<string | undefined>();
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const templates = useQuery({
    queryKey: ["project-templates-min"],
    queryFn: async () => (await supabase.from("project_templates").select("id,name").order("created_at", { ascending: false })).data ?? [],
    enabled: open,
  });

  const customers = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => (await supabase.from("customers").select("id,name").order("name")).data ?? [],
    enabled: open,
  });
  const vendors = useQuery({
    queryKey: ["vendors-min"],
    queryFn: async () => (await supabase.from("vendors").select("id,name").order("name")).data ?? [],
    enabled: open,
  });
  const products = useQuery({
    queryKey: ["products-min"],
    queryFn: async () => (await supabase.from("products").select("id,name").order("name")).data ?? [],
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            vendor_id: vendorId ?? null, product_id: productId ?? null,
          }).select("id").single();
          if (error) { setSubmitting(false); return toast.error(error.message); }
          if (templateId && data?.id) {
            try {
              await instantiateTemplate({ templateId, newProjectId: data.id, createdBy: ownerId, startDate: start || null });
            } catch (err) {
              toast.error("Project created, but template failed: " + (err as Error).message);
            }
          }
          setSubmitting(false);
          toast.success("Project created");
          setOpen(false); setName(""); setDesc(""); setStart(""); setDue("");
          setStatus("planning"); setPriority("normal"); setTemplateId(undefined);
          setCustomerId(undefined); setManagerId(undefined); setVendorId(undefined); setProductId(undefined);
          onCreated(data?.id);
        }} className="space-y-4">
          {(templates.data ?? []).length > 0 && (
            <div className="space-y-2">
              <Label>From template (optional)</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Start blank" /></SelectTrigger>
                <SelectContent>
                  {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Milestones &amp; tasks will be copied with dates relative to the start date below.</p>
            </div>
          )}
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
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => setVendorId(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(vendors.data ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={(v) => setProductId(v || undefined)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary PM</Label>
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
