import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Target, ListChecks, MessageSquare, Users, Activity as ActivityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProject } from "@/hooks/use-project";
import { STATUS_META, formatDate, TASK_STATUS_META } from "@/lib/project-meta";
import { ProjectManagers } from "@/components/project/project-managers";
import { ProjectFiles } from "@/components/project/project-files";

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { project, members, staff, canManage } = useProject(projectId);

  const customer = useQuery({
    queryKey: ["project-customer", projectId],
    queryFn: async () => {
      const cid = (project.data as { customer_id?: string | null } | undefined)?.customer_id;
      if (!cid) return null;
      return (await supabase.from("customers").select("id,name").eq("id", cid).maybeSingle()).data;
    },
    enabled: !!project.data,
  });
  const vendor = useQuery({
    queryKey: ["project-vendor", projectId],
    queryFn: async () => {
      const vid = (project.data as { vendor_id?: string | null } | undefined)?.vendor_id;
      if (!vid) return null;
      return (await supabase.from("vendors").select("id,name").eq("id", vid).maybeSingle()).data;
    },
    enabled: !!project.data,
  });
  const product = useQuery({
    queryKey: ["project-product", projectId],
    queryFn: async () => {
      const pid = (project.data as { product_id?: string | null } | undefined)?.product_id;
      if (!pid) return null;
      return (await supabase.from("products").select("id,name,code").eq("id", pid).maybeSingle()).data;
    },
    enabled: !!project.data,
  });

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => (await supabase.from("project_milestones").select("*").eq("project_id", projectId).is("deleted_at", null)).data ?? [],
  });
  const tasks = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => (await supabase.from("project_tasks").select("id,status,assignee_id,title,due_date").eq("project_id", projectId).is("deleted_at", null)).data ?? [],
  });
  const updates = useQuery({
    queryKey: ["project-updates", projectId],
    queryFn: async () => (await supabase.from("project_status_updates").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
  const activity = useQuery({
    queryKey: ["project-activity-recent", projectId],
    queryFn: async () => (await supabase.from("project_activity").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(8)).data ?? [],
  });

  if (!project.data) return null;
  const p = project.data;

  const ms = milestones.data ?? [];
  const ts = tasks.data ?? [];
  const avgProgress = ms.length > 0 ? Math.round(ms.reduce((s, m) => s + (m.progress ?? 0), 0) / ms.length) : 0;
  const doneTasks = ts.filter((t) => t.status === "done").length;
  const overdueTasks = ts.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date()).length;
  const owner = staff.data?.find((s) => s.id === p.owner_id);
  const manager = staff.data?.find((s) => s.id === p.manager_id);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Overall progress</p>
          <p className="text-2xl font-semibold mt-1">{avgProgress}%</p>
          <Progress value={avgProgress} className="mt-2" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Milestones</p>
          <p className="text-2xl font-semibold mt-1">
            {ms.filter((m) => m.status === "completed").length}<span className="text-sm text-muted-foreground"> / {ms.length}</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><ListChecks className="h-3 w-3" /> Tasks</p>
          <p className="text-2xl font-semibold mt-1">
            {doneTasks}<span className="text-sm text-muted-foreground"> / {ts.length}</span>
          </p>
          {overdueTasks > 0 && <p className="text-[11px] text-destructive mt-1">{overdueTasks} overdue</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Team</p>
          <p className="text-2xl font-semibold mt-1">{(members.data?.length ?? 0) + 1}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-3">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {p.description || "No description."}
            </p>
            <dl className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div><dt className="text-muted-foreground">Owner</dt><dd className="font-medium">{owner?.full_name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Primary PM</dt><dd className="font-medium">{manager?.full_name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{customer.data?.name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Vendor</dt><dd className="font-medium">{vendor.data?.name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Product</dt><dd className="font-medium">{product.data ? `${product.data.name}${product.data.code ? ` (${product.data.code})` : ""}` : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Start</dt><dd>{formatDate(p.start_date)}</dd></div>
              <div><dt className="text-muted-foreground">Due</dt><dd>{formatDate(p.due_date)}</dd></div>
            </dl>
          </Card>

          <ProjectManagers projectId={projectId} canManage={canManage} />

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Latest status updates</h2>
              <Link to="/projects/$projectId/activity" params={{ projectId }} className="text-xs text-muted-foreground hover:underline">View activity →</Link>
            </div>
            {(updates.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No updates yet.</p>
            ) : (
              <div className="space-y-3">
                {(updates.data ?? []).map((u) => {
                  const a = staff.data?.find((s) => s.id === u.author_id);
                  return (
                    <div key={u.id} className="flex items-start gap-2 text-xs">
                      <Avatar className="h-6 w-6">
                        {a?.avatar_url && <AvatarImage src={a.avatar_url} />}
                        <AvatarFallback className="text-[10px]">{(a?.full_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a?.full_name ?? "?"}</span>
                          {u.status && <Badge variant="outline" className="text-[10px]">{STATUS_META[u.status]?.label ?? u.status}</Badge>}
                          <span className="text-muted-foreground ml-auto">{new Date(u.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap">{u.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><ActivityIcon className="h-4 w-4" /> Recent activity</h2>
          {(activity.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {(activity.data ?? []).map((a) => {
                const actor = staff.data?.find((s) => s.id === a.actor_id);
                return (
                  <li key={a.id} className="text-xs border-l-2 border-muted pl-2">
                    <p>
                      <span className="font-medium">{actor?.full_name ?? "System"}</span>
                      {" "}
                      <span className="text-muted-foreground">{a.action.replace(/_/g," ")} {a.entity_type}</span>
                    </p>
                    {a.summary && <p className="text-muted-foreground truncate">{a.summary}</p>}
                    <p className="text-[10px] text-muted-foreground/70">{new Date(a.created_at).toLocaleString()}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Task breakdown</p>
            <div className="space-y-1">
              {Object.entries(TASK_STATUS_META).map(([k, m]) => {
                const count = ts.filter((t) => t.status === k).length;
                return (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span>{m.label}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}