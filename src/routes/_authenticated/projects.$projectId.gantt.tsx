import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProject } from "@/hooks/use-project";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/project-meta";
import { computeDependencyWarnings, type DepTask } from "@/lib/project-dependencies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId/gantt")({
  component: GanttPage,
});

const DAY = 1000 * 60 * 60 * 24;
const LABEL_W = 224; // 14rem

type Bar = {
  id: string;
  title: string;
  kind: "milestone" | "task";
  start: Date;
  end: Date;
  status: string;
  priority?: string;
  predecessors?: string[];
};

function GanttPage() {
  const { projectId } = Route.useParams();
  const { project } = useProject(projectId);

  const milestones = useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async () => (await supabase.from("project_milestones").select("*").eq("project_id", projectId).is("deleted_at", null)).data ?? [],
  });

  const tasks = useQuery({
    queryKey: ["project-tasks-gantt", projectId],
    queryFn: async () => (await supabase.from("project_tasks").select("id,title,start_date,due_date,status,priority,predecessor_ids").eq("project_id", projectId).is("deleted_at", null)).data ?? [],
  });

  const warnings = useMemo(() => {
    return computeDependencyWarnings((tasks.data ?? []) as DepTask[]);
  }, [tasks.data]);

  const bars: Bar[] = useMemo(() => {
    const arr: Bar[] = [];
    (milestones.data ?? []).forEach((m) => {
      if (!m.due_date) return;
      const end = new Date(m.due_date);
      const start = new Date(end.getTime() - DAY * 3);
      arr.push({ id: m.id, title: m.title, kind: "milestone", start, end, status: m.status });
    });
    (tasks.data ?? []).forEach((t) => {
      const endStr = t.due_date ?? t.start_date;
      if (!endStr) return;
      const end = new Date(endStr);
      const start = t.start_date ? new Date(t.start_date) : new Date(end.getTime() - DAY * 2);
      arr.push({
        id: t.id, title: t.title, kind: "task", start, end,
        status: t.status, priority: t.priority,
        predecessors: t.predecessor_ids ?? [],
      });
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

  const rangeStart = new Date(Math.min(
    project.data.start_date ? new Date(project.data.start_date).getTime() : Infinity,
    ...bars.map((b) => b.start.getTime())
  ));
  const rangeEnd = new Date(Math.max(
    project.data.due_date ? new Date(project.data.due_date).getTime() : -Infinity,
    ...bars.map((b) => b.end.getTime())
  ));
  rangeStart.setDate(rangeStart.getDate() - 2);
  rangeEnd.setDate(rangeEnd.getDate() + 2);
  const totalDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / DAY));

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

  // Row geometry for SVG dependency arrows
  const ROW_H = 36;
  const HEADER_H = 32;
  const indexById = new Map(bars.map((b, i) => [b.id, i]));
  const barById = new Map(bars.map((b) => [b.id, b]));

  type Arrow = { x1: number; y1: number; x2: number; y2: number; warn: boolean };
  const warnPairs = new Set(
    warnings
      .filter((w) => w.predecessorId)
      .map((w) => `${w.predecessorId}->${w.taskId}`),
  );
  const arrows: Arrow[] = [];
  bars.forEach((b, i) => {
    if (!b.predecessors || b.predecessors.length === 0) return;
    for (const pid of b.predecessors) {
      const p = barById.get(pid);
      const pi = indexById.get(pid);
      if (!p || pi == null) continue;
      const x1Pct = ((p.end.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;
      const x2Pct = ((b.start.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;
      arrows.push({
        x1: x1Pct, y1: pi * ROW_H + ROW_H / 2,
        x2: x2Pct, y2: i * ROW_H + ROW_H / 2,
        warn: warnPairs.has(`${pid}->${b.id}`),
      });
    }
  });

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/5 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{warnings.length} dependency warning{warnings.length === 1 ? "" : "s"}</AlertTitle>
          <AlertDescription>
            <ul className="text-xs mt-1 list-disc pl-4 space-y-0.5">
              {warnings.slice(0, 6).map((w, i) => <li key={i}>{w.message}</li>)}
              {warnings.length > 6 && <li className="opacity-70">…and {warnings.length - 6} more</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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

          <div className="relative" style={{ height: bars.length * ROW_H }}>
            {/* Dependency arrows overlay */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: LABEL_W, top: 0, right: 0, height: bars.length * ROW_H, width: `calc(100% - ${LABEL_W}px)` }}
              preserveAspectRatio="none"
              viewBox={`0 0 100 ${bars.length * ROW_H}`}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                </marker>
                <marker id="arrow-warn" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--destructive))" />
                </marker>
              </defs>
              {arrows.map((a, i) => {
                const midX = (a.x1 + a.x2) / 2;
                const path = `M ${a.x1} ${a.y1} C ${midX} ${a.y1}, ${midX} ${a.y2}, ${a.x2} ${a.y2}`;
                return (
                  <path
                    key={i}
                    d={path}
                    fill="none"
                    stroke={a.warn ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
                    strokeWidth={a.warn ? 0.5 : 0.3}
                    strokeDasharray={a.warn ? "0.8 0.6" : "0"}
                    opacity={a.warn ? 0.9 : 0.5}
                    markerEnd={a.warn ? "url(#arrow-warn)" : "url(#arrow)"}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {todayPct !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-primary z-10" style={{ left: `calc(${LABEL_W}px + ${todayPct}% * (100% - ${LABEL_W}px) / 100)` }} />
            )}
            {bars.map((b) => {
              const left = ((b.start.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;
              const width = Math.max(1, ((b.end.getTime() - b.start.getTime()) / DAY / totalDays) * 100);
              const taskMeta = b.kind === "task" ? TASK_STATUS_META[b.status] : null;
              const priMeta = b.priority ? PRIORITY_META[b.priority] : null;
              const hasWarning = warnings.some((w) => w.taskId === b.id);
              return (
                <div key={b.id} className="flex items-center border-b border-muted/40 hover:bg-muted/20" style={{ height: ROW_H }}>
                  <div className="w-56 shrink-0 px-2 py-2 text-xs flex items-center gap-1.5 min-w-0">
                    <span className={cn("h-2 w-2 rounded-full shrink-0",
                      b.kind === "milestone" ? "bg-primary" : "bg-muted-foreground"
                    )} />
                    <span className="truncate" title={b.title}>{b.title}</span>
                    {hasWarning && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
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

          <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Milestone</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-500" /> In progress</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500" /> Done</span>
            <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-destructive" /> Blocked</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Dependency warning</span>
            {todayPct !== null && <span className="flex items-center gap-1"><span className="h-3 w-px bg-primary" /> Today</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}
