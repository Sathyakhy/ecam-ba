import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid, ListChecks, Target, GanttChartSquare, Users, Activity, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META, PRIORITY_META, formatDate } from "@/lib/project-meta";

type ProjectLite = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
};

const tabs = [
  { to: "/projects/$projectId" as const, label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/projects/$projectId/tasks" as const, label: "Tasks", icon: ListChecks },
  { to: "/projects/$projectId/milestones" as const, label: "Milestones", icon: Target },
  { to: "/projects/$projectId/timeline" as const, label: "Timeline", icon: CalendarRange },
  { to: "/projects/$projectId/gantt" as const, label: "Gantt", icon: GanttChartSquare },
  { to: "/projects/$projectId/members" as const, label: "Members", icon: Users },
  { to: "/projects/$projectId/activity" as const, label: "Activity", icon: Activity },
];

export function ProjectHeader({ project, right }: { project: ProjectLite; right?: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const status = STATUS_META[project.status] ?? STATUS_META.planning;
  const priority = PRIORITY_META[project.priority] ?? PRIORITY_META.normal;
  const base = `/projects/${project.id}`;

  return (
    <div className="space-y-4">
      <Link to="/projects" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={priority.variant}>{priority.label}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl line-clamp-2">{project.description}</p>
          )}
          {(project.start_date || project.due_date) && (
            <p className="text-xs text-muted-foreground mt-2">
              {formatDate(project.start_date)} → {formatDate(project.due_date)}
            </p>
          )}
        </div>
        {right}
      </div>

      <div className="border-b -mx-1 px-1 overflow-x-auto">
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const href = t.exact ? base : `${base}${t.to.replace("/projects/$projectId", "")}`;
            const active = t.exact ? path === base : path.startsWith(href);
            return (
              <Link
                key={t.label}
                to={t.to}
                params={{ projectId: project.id }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
