import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import {
  Users, UserPlus, GraduationCap, CheckSquare, ArrowRight, Megaphone,
  Activity, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { profile, isAdmin } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard-stats", profile?.id, isAdmin],
    queryFn: async () => {
      const [staffCount, onbAll, onbDone, trAll, trDone, tasksAll, tasksDone, anns] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("onboarding_tasks").select("*", { count: "exact", head: true }),
        supabase.from("onboarding_tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("training_assignments").select("*", { count: "exact", head: true }),
        supabase.from("training_assignments").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("announcements").select("id,title,content,created_at").order("created_at", { ascending: false }).limit(3),
      ]);
      return {
        staff: staffCount.count ?? 0,
        onbTotal: onbAll.count ?? 0, onbDone: onbDone.count ?? 0,
        trTotal: trAll.count ?? 0, trDone: trDone.count ?? 0,
        tasksTotal: tasksAll.count ?? 0, tasksDone: tasksDone.count ?? 0,
        anns: anns.data ?? [],
      };
    },
  });

  const myTasks = useQuery({
    queryKey: ["my-project-tasks", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const orFilter = `assignee_id.eq.${profile!.id},pic_orgs.cs.{${profile!.full_name}}`;
      const { data } = await supabase
        .from("project_tasks")
        .select("id,title,status,priority,due_date,project_id,progress")
        .or(orFilter)
        .neq("status", "done")
        .neq("status", "completed")
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8);
      const ids = Array.from(new Set((data ?? []).map((t) => t.project_id)));
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from("projects").select("id,name").in("id", ids);
        (ps ?? []).forEach((p) => { names[p.id] = p.name; });
      }
      return (data ?? []).map((t) => ({ ...t, project_name: names[t.project_id] ?? "Project" }));
    },
  });

  const recentActivity = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_activity")
        .select("id,action,summary,created_at,entity_type,project_id,actor_id")
        .order("created_at", { ascending: false })
        .limit(8);
      const ids = Array.from(new Set((data ?? []).map((a) => a.project_id)));
      const aids = Array.from(new Set((data ?? []).map((a) => a.actor_id).filter(Boolean))) as string[];
      const [{ data: ps }, { data: actors }] = await Promise.all([
        ids.length
          ? supabase.from("projects").select("id,name").in("id", ids)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        aids.length
          ? supabase.from("profiles").select("id,full_name").in("id", aids)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      ]);
      return (data ?? []).map((a) => ({
        ...a,
        project_name: ps?.find((p) => p.id === a.project_id)?.name ?? "Project",
        actor_name: actors?.find((x) => x.id === a.actor_id)?.full_name ?? "System",
      }));
    },
  });

  const myOnboarding = useQuery({
    queryKey: ["my-onboarding", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_tasks")
        .select("id,title,status,due_date")
        .eq("profile_id", profile!.id)
        .order("order_index");
      return data ?? [];
    },
  });

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        description="Here's what's happening across your department today."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Staff" value={stats.data?.staff ?? "—"} hint="In department" />
        <StatCard icon={UserPlus} label="Onboarding" value={`${pct(stats.data?.onbDone ?? 0, stats.data?.onbTotal ?? 0)}%`} hint={`${stats.data?.onbDone ?? 0} of ${stats.data?.onbTotal ?? 0} tasks done`} />
        <StatCard icon={GraduationCap} label="Training" value={`${pct(stats.data?.trDone ?? 0, stats.data?.trTotal ?? 0)}%`} hint={`${stats.data?.trDone ?? 0} of ${stats.data?.trTotal ?? 0} completions`} />
        <StatCard icon={CheckSquare} label="Tasks" value={`${pct(stats.data?.tasksDone ?? 0, stats.data?.tasksTotal ?? 0)}%`} hint={`${stats.data?.tasksDone ?? 0} of ${stats.data?.tasksTotal ?? 0} done`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My open tasks</h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {myTasks.data?.length ? (
            <ul className="divide-y divide-border">
              {myTasks.data.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={t.priority === "high" ? "destructive" : "secondary"}>{t.priority}</Badge>
                    <Badge variant="outline">{t.status.replace("_", " ")}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="You have no open tasks. Nice." />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My onboarding</h2>
            <Link to="/onboarding" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Open <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {myOnboarding.data?.length ? (
            <>
              <Progress
                value={pct(
                  myOnboarding.data.filter((t) => t.status === "completed").length,
                  myOnboarding.data.length,
                )}
                className="mb-4"
              />
              <ul className="space-y-2">
                {myOnboarding.data.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-1.5 w-1.5 rounded-full ${t.status === "completed" ? "bg-success" : t.status === "in_progress" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                    <span className="truncate flex-1">{t.title}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyHint text="No onboarding tasks assigned." />
          )}
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Latest announcements</h2>
          <Link to="/announcements" className="ml-auto text-xs text-primary hover:underline">View all</Link>
        </div>
        {stats.data?.anns.length ? (
          <ul className="space-y-3">
            {stats.data.anns.map((a) => (
              <li key={a.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{a.title}</p>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint text="No announcements yet." />
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-semibold mt-2">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}
