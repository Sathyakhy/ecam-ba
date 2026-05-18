import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useProject } from "@/hooks/use-project";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/project-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/gantt")({
  component: GanttPage,
});

const DAY = 1000 * 60 * 60 * 24;

type Bar = {
  id: string;
  title: string;
  kind: "milestone" | "task";
  start: Date;
  end: Date;
  status: string;
  priority?: string;
};

function GanttPage() {
  const { projectId } = Route.useParams();
  const { project } = useProject(projectId);

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => (await supabase.from("project_milestones").select("*").eq("project_id", projectId)).data ?? [],
  });

  const tasks = useQuery({
    queryKey: ["project-tasks-gantt", projectId],
    queryFn: async () => (await supabase.from("project_tasks").select("id,title,start_date,due_date,status,priority").eq("project_id", projectId)).data ?? [],
  });

  const bars: Bar[] = useMemo(() => {
    const arr: Bar[] = [];
    (milestones.data ?? []).forEach((m) => {
      if (!m.due_date) return;
      const end = new Date(m.due_date);
      const start = new Date(end.getTime() - DAY * 3);
      arr.push({ id: m.id, title: m.title, kind: "milestone", start, end, status: m.status });
    });
    (tasks.data ?? []).forEach((t) => {
      if (!t.due_date && !t.start_date) return;
      const end = new Date(t.due_date ?? t.start_date);
      const start = t.start_date ? new Date(t.start_date) : new Date(end.getTime() - DAY * 2);
      arr.push({ id: t.id, title: t.title, kind: "task", start, end, status: t.status, priority: t.priority });
    });
    return arr.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [milestones.data, tasks.data]);

  if (!project.data) return null;

  if (bars.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <p className="text-sm text-muted-foreground">No scheduled milestones or tasks yet. Add due dates to see the timeline.</p>
      </Card>
    );
  }

  // compute range
  const rangeStart = new Date(Math.min(
    project.data.start_date ? new Date(project.data.start_date).getTime() : Infinity,
    ...bars.map((b) => b.start.getTime())
  ));
  const rangeEnd = new Date(Math.max(
    project.data.due_date ? new Date(project.data.due_date).getTime() : -Infinity,
    ...bars.map((b) => b.end.getTime())
  ));
  // pad
  rangeStart.setDate(rangeStart.getDate() - 2);
  rangeEnd.setDate(rangeEnd.getDate() + 2);
  const totalDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / DAY));

  // generate week ticks
  const ticks: { date: Date; left: number }[] = [];
  const tick = new Date(rangeStart);
  while (tick <= rangeEnd) {
    ticks.push({ date: new Date(tick), left: ((tick.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100 });
    tick.setDate(tick.getDate() + 7);
  }

  const today = new Date();
  const todayPct = today >= rangeStart && today <= rangeEnd
    ? ((today.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100
    : null;

  return (
    <Card className="p-4 overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex">
          <div className="w-56 shrink-0 text-xs font-semibold text-muted-foreground px-2 py-1.5">Item</div>
          <div className="flex-1 relative h-8 border-b">
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-muted text-[10px] text-muted-foreground pl-1"
                style={{ left: `${t.left}%` }}>
                {t.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          {todayPct !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-primary z-10" style={{ left: `calc(14rem + ${todayPct}% * (100% - 14rem) / 100)` }} />
          )}
          {bars.map((b) => {
            const left = ((b.start.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;
            const width = Math.max(1, ((b.end.getTime() - b.start.getTime()) / DAY / totalDays) * 100);
            const taskMeta = b.kind === "task" ? TASK_STATUS_META[b.status] : null;
            const priMeta = b.priority ? PRIORITY_META[b.priority] : null;
            return (
              <div key={b.id} className="flex items-center border-b border-muted/40 hover:bg-muted/20">
                <div className="w-56 shrink-0 px-2 py-2 text-xs flex items-center gap-1.5 min-w-0">
                  <span className={cn("h-2 w-2 rounded-full shrink-0",
                    b.kind === "milestone" ? "bg-primary" : "bg-muted-foreground"
                  )} />
                  <span className="truncate" title={b.title}>{b.title}</span>
                </div>
                <div className="flex-1 relative h-9">
                  <div
                    className={cn(
                      "absolute top-1.5 bottom-1.5 rounded text-[10px] px-1.5 flex items-center text-white shadow-sm overflow-hidden",
                      b.kind === "milestone" ? "bg-primary" :
                      b.status === "done" ? "bg-emerald-500" :
                      b.status === "blocked" ? "bg-destructive" :
                      b.status === "in_progress" ? "bg-blue-500" :
                      "bg-slate-400"
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${b.title} · ${taskMeta?.label ?? b.status}${priMeta ? " · " + priMeta.label : ""}`}
                  >
                    <span className="truncate">{b.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Milestone</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-500" /> In progress</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500" /> Done</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-destructive" /> Blocked</span>
          {todayPct !== null && <span className="flex items-center gap-1"><span className="h-3 w-px bg-primary" /> Today</span>}
        </div>
      </div>
    </Card>
  );
}
