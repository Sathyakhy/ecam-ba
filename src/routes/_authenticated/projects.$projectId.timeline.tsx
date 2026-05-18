import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown, Pencil, Search, X, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import { useProject } from "@/hooks/use-project";
import { TASK_STATUS_META, metaEntries } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { TaskDetailDrawer } from "@/components/project/task-detail-drawer";

export const Route = createFileRoute("/_authenticated/projects/$projectId/timeline")({
  component: TimelinePage,
});

const DAY = 1000 * 60 * 60 * 24;

type Task = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  actual_completion_date: string | null;
  actual_start: string | null;
  baseline_start: string | null;
  baseline_finish: string | null;
  task_mode: string | null;
  assignee_id: string | null;
  module: string | null;
  site: string | null;
  man_days: number | null;
  remark: string | null;
  predecessor_ids: string[] | null;
  progress: number | null;
  pic_org: string | null;
  pic_orgs: string[] | null;
  created_by: string;
  order_index: number;
};

// Compute effective progress: parents roll up from sub-task average; leaves use their own value.
function effectiveProgress(task: Task, childMap: Record<string, Task[]>): number {
  const kids = childMap[task.id] ?? [];
  if (kids.length === 0) return Math.max(0, Math.min(100, task.progress ?? 0));
  const sum = kids.reduce((acc, k) => acc + effectiveProgress(k, childMap), 0);
  return Math.round(sum / kids.length);
}

function TimelinePage() {
  const { projectId } = Route.useParams();
  const { project, staff, canManage, isMember, profile } = useProject(projectId);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [fModule, setFModule] = useState<string>("all");
  const [fSite, setFSite] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fAssignee, setFAssignee] = useState<string>("all");

  const tasksQ = useQuery({
    queryKey: ["timeline-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks").select("*").eq("project_id", projectId)
        .order("order_index").order("created_at");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const orgsQ = useQuery({
    queryKey: ["timeline-orgs", projectId, project.data?.customer_id, project.data?.vendor_id],
    enabled: !!project.data,
    queryFn: async () => {
      const names: string[] = ["eCam"];
      if (project.data?.customer_id) {
        const { data } = await supabase.from("customers").select("name").eq("id", project.data.customer_id).maybeSingle();
        if (data?.name) names.push(data.name);
      }
      if (project.data?.vendor_id) {
        const { data } = await supabase.from("vendors").select("name").eq("id", project.data.vendor_id).maybeSingle();
        if (data?.name) names.push(data.name);
      }
      return Array.from(new Set(names));
    },
  });
  const orgs = orgsQ.data ?? ["eCam"];

  const statusesQ = useQuery({
    queryKey: ["task-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("task_statuses").select("key,label,sort_order").order("sort_order");
      return (data ?? []) as { key: string; label: string; sort_order: number }[];
    },
  });
  const statusOptions = useMemo(() => {
    const rows = statusesQ.data ?? [];
    if (rows.length === 0) {
      return metaEntries(TASK_STATUS_META).map(([k, m]) => ({ key: k, label: m.label }));
    }
    return rows.map((r) => ({ key: r.key, label: r.label }));
  }, [statusesQ.data]);
  const statusLabel = (k: string) =>
    statusOptions.find((s) => s.key === k)?.label ?? TASK_STATUS_META[k]?.label ?? k;

  const tasks = tasksQ.data ?? [];
  const roots = useMemo(() => tasks.filter((t) => !t.parent_task_id), [tasks]);
  const childMap = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.parent_task_id) {
        m[t.parent_task_id] = m[t.parent_task_id] ?? [];
        m[t.parent_task_id].push(t);
      }
    });
    return m;
  }, [tasks]);

  const canEdit = canManage || isMember;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["timeline-tasks", projectId] });

  const refresh = () => invalidate();

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  // Numbering map: task.id -> "1" or "1.2"  (stable, based on full unfiltered tree)
  const taskNo = useMemo(() => {
    const m: Record<string, string> = {};
    roots.forEach((r, i) => {
      m[r.id] = String(i + 1);
      (childMap[r.id] ?? []).forEach((c, j) => {
        m[c.id] = `${i + 1}.${j + 1}`;
      });
    });
    return m;
  }, [roots, childMap]);

  // Distinct values for filter dropdowns
  const modules = useMemo(() => Array.from(new Set(tasks.map((t) => t.module).filter((x): x is string => !!x))).sort(), [tasks]);
  const sites = useMemo(() => Array.from(new Set(tasks.map((t) => t.site).filter((x): x is string => !!x))).sort(), [tasks]);

  const taskPics = (t: Task): string[] => {
    const arr = (t.pic_orgs ?? []).filter(Boolean);
    if (arr.length === 0 && t.pic_org) return [t.pic_org];
    return arr;
  };

  const q = search.trim().toLowerCase();
  const taskMatches = (t: Task) => {
    if (fModule !== "all" && (t.module ?? "") !== fModule) return false;
    if (fSite !== "all" && (t.site ?? "") !== fSite) return false;
    if (fStatus !== "all" && t.status !== fStatus) return false;
    if (fAssignee !== "all") {
      const pics = taskPics(t);
      if (fAssignee === "unassigned") {
        if (pics.length > 0) return false;
      } else if (!pics.includes(fAssignee)) {
        return false;
      }
    }
    if (q) {
      const hay = `${t.title} ${t.description ?? ""} ${t.remark ?? ""} ${t.module ?? ""} ${t.site ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtersActive = !!q || fModule !== "all" || fSite !== "all" || fStatus !== "all" || fAssignee !== "all";

  // For the table: keep a root if it matches or any child matches; keep matching children.
  // If a filter is set and a parent only matches via its children, show all its kids too? -- show only matching kids so user sees the slice.
  const visibleRoots = useMemo(() => {
    if (!filtersActive) return roots;
    return roots.filter((r) => taskMatches(r) || (childMap[r.id] ?? []).some(taskMatches));
  }, [roots, childMap, filtersActive, q, fModule, fSite, fStatus, fAssignee]);

  const visibleChildren = (rootId: string) => {
    const kids = childMap[rootId] ?? [];
    if (!filtersActive) return kids;
    return kids.filter(taskMatches);
  };

  // Gantt bars: only filtered tasks that have any date.
  const filteredTasks = useMemo(() => tasks.filter(taskMatches), [tasks, q, fModule, fSite, fStatus, fAssignee]);
  const bars = filteredTasks.filter((t) => t.start_date || t.due_date);

  if (!project.data) return null;

  const clearFilters = () => {
    setSearch(""); setFModule("all"); setFSite("all"); setFStatus("all"); setFAssignee("all");
  };

  return (
    <div className="space-y-6">
      <Card className="p-3 overflow-x-auto">
        <div className="flex items-center justify-between mb-3 px-1 gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Timeline (Tasks)</h3>
          {canEdit && (
            <TaskDialog
              projectId={projectId}
              authorId={profile?.id ?? ""}
              staff={staff.data ?? []}
              orgs={orgs}
              roots={roots}
              statusOptions={statusOptions}
              onSaved={refresh}
              allTasks={tasks}
              taskNo={taskNo}
              trigger={<Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New main task</Button>}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-7 w-56 text-xs"
            />
          </div>
          <Select value={fModule} onValueChange={setFModule}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fSite} onValueChange={setFSite}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Site" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fAssignee} onValueChange={setFAssignee}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="PIC" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PIC</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {orgs.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
          {filtersActive && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              Showing {filteredTasks.length} of {tasks.length} task{tasks.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <Th className="w-10">ID</Th>
              <Th className="w-14">Task<br/>Mode</Th>
              <Th className="min-w-[320px] text-left">Task Name</Th>
              <Th className="w-20">Duration</Th>
              <Th className="w-28">Start</Th>
              <Th className="w-28">Finish</Th>
              <Th className="w-28">Predecessors</Th>
              <Th className="min-w-[160px] text-left">Remark</Th>
              <Th className="w-20"></Th>
            </tr>
          </thead>
          <tbody>
            {visibleRoots.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">
                {tasks.length === 0 ? "No tasks yet." : "No tasks match the current filters."}
              </td></tr>
            )}
            {(() => {
              let rowId = 0;
              return visibleRoots.map((root) => {
                const children = visibleChildren(root.id);
                const isOpen = expanded[root.id] ?? true;
                const rootId = rowId++;
                const childIds = children.map(() => rowId++);
                return (
                  <RowGroup
                    key={root.id}
                    rowId={rootId}
                    childRowIds={childIds}
                    task={root}
                    children={children}
                    isOpen={isOpen}
                    onToggle={() => toggle(root.id)}
                    staff={staff.data ?? []}
                    orgs={orgs}
                    roots={roots}
                    statusOptions={statusOptions}
                    canEdit={canEdit}
                    onEdit={(t) => setEditing(t)}
                    onDeleted={refresh}
                    projectId={projectId}
                    authorId={profile?.id ?? ""}
                    onSaved={refresh}
                    allTasks={tasks}
                    taskNo={taskNo}
                    childMap={childMap}
                  />
                );
              });
            })()}
          </tbody>
        </table>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Gantt Chart {filtersActive && <span className="text-[11px] font-normal text-muted-foreground">(filtered)</span>}</h3>
        <GanttView tasks={bars} childMap={childMap} projectStart={project.data.start_date} projectDue={project.data.due_date} canEdit={canEdit} onChanged={refresh} />
      </Card>

      {editing && (
        <TaskDialog
          projectId={projectId}
          authorId={profile?.id ?? ""}
          staff={staff.data ?? []}
          orgs={orgs}
          roots={roots}
          statusOptions={statusOptions}
          onSaved={refresh}
          allTasks={tasks}
          taskNo={taskNo}
          task={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border px-2 py-1.5 font-medium text-[11px] text-center whitespace-nowrap", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border px-2 py-1.5 align-top", className)}>{children}</td>;
}

function RowGroup({
  rowId, childRowIds, task, children, isOpen, onToggle, staff, orgs, roots, statusOptions, canEdit, onEdit, onDeleted, projectId, authorId, onSaved, allTasks, taskNo, childMap,
}: {
  rowId: number;
  childRowIds: number[];
  task: Task;
  children: Task[];
  isOpen: boolean;
  onToggle: () => void;
  staff: { id: string; full_name: string }[];
  orgs: string[];
  roots: Task[];
  statusOptions: { key: string; label: string }[];
  canEdit: boolean;
  onEdit: (t: Task) => void;
  onDeleted: () => void;
  projectId: string;
  authorId: string;
  onSaved: () => void;
  allTasks: Task[];
  taskNo: Record<string, string>;
  childMap: Record<string, Task[]>;
}) {
  return (
    <>
      <RowItem
        rowId={rowId}
        task={task}
        staff={staff}
        canEdit={canEdit}
        onEdit={onEdit}
        onDeleted={onDeleted}
        isParent
        hasChildren={children.length > 0}
        isOpen={isOpen}
        onToggle={onToggle}
        taskNo={taskNo}
        indent={0}
        extraActions={canEdit && (
          <TaskDialog
            projectId={projectId}
            authorId={authorId}
            staff={staff}
            orgs={orgs}
            roots={roots}
            statusOptions={statusOptions}
            onSaved={onSaved}
            parentTaskId={task.id}
            allTasks={allTasks}
            taskNo={taskNo}
            trigger={<Button size="icon" variant="ghost" className="h-6 w-6" title="Add sub-task"><Plus className="h-3 w-3" /></Button>}
          />
        )}
      />
      {isOpen && children.map((c, i) => (
        <RowItem
          key={c.id}
          rowId={childRowIds[i]}
          task={c}
          staff={staff}
          canEdit={canEdit}
          onEdit={onEdit}
          onDeleted={onDeleted}
          isParent={false}
          taskNo={taskNo}
          indent={1}
        />
      ))}
      {void childMap}
    </>
  );
}

function computeDuration(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) {
    const d = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY)) + 1;
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  return "1 day?";
}

function formatMsDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, "0");
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const yr = String(dt.getFullYear()).slice(-2);
  return `${weekdays[dt.getDay()]} ${day}.${String(dt.getMonth()+1).padStart(2,"0")}.${yr}`;
}

function RowItem({
  rowId, task, staff, canEdit, onEdit, onDeleted, isParent, hasChildren, isOpen, onToggle, extraActions, taskNo, indent,
}: {
  rowId: number;
  task: Task;
  staff: { id: string; full_name: string }[];
  canEdit: boolean;
  onEdit: (t: Task) => void;
  onDeleted: () => void;
  isParent: boolean;
  hasChildren?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  extraActions?: React.ReactNode;
  taskNo: Record<string, string>;
  indent: number;
}) {
  void staff;

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("project_tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onDeleted();
  };

  const depLabels = (task.predecessor_ids ?? []).map((id) => taskNo[id]).filter(Boolean);
  const duration = computeDuration(task.start_date, task.due_date);

  return (
    <tr className={cn("hover:bg-muted/30 group", isParent && "font-semibold")}>
      <Td className="text-center text-muted-foreground tabular-nums">{rowId}</Td>
      <Td className="text-center">
        <ListChecks className="h-3.5 w-3.5 mx-auto text-blue-600" />
      </Td>
      <Td>
        <div className="flex items-start gap-1" style={{ paddingLeft: `${indent * 18}px` }}>
          {isParent && hasChildren ? (
            <button onClick={onToggle} className="mt-0.5 shrink-0">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="whitespace-pre-wrap break-words">{task.title}</span>
        </div>
      </Td>
      <Td className="whitespace-nowrap">{duration}</Td>
      <Td className="whitespace-nowrap">{formatMsDate(task.start_date)}</Td>
      <Td className="whitespace-nowrap">{formatMsDate(task.due_date)}</Td>
      <Td className="whitespace-nowrap text-center">{depLabels.length ? depLabels.join(";") : ""}</Td>
      <Td className="text-[11px] whitespace-pre-wrap">{task.remark ?? ""}</Td>
      <Td className="text-center">
        {canEdit && (
          <div className="flex items-center gap-0.5 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(task)} title="Edit">
              <Pencil className="h-3 w-3" />
            </Button>
            {extraActions}
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={handleDelete} title="Delete">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </Td>
    </tr>
  );
}

function TaskDialog({
  projectId, authorId, staff, orgs, roots, statusOptions, onSaved, parentTaskId, trigger, task, open: openProp, onOpenChange, allTasks, taskNo,
}: {
  projectId: string;
  authorId: string;
  staff: { id: string; full_name: string }[];
  orgs: string[];
  roots: Task[];
  statusOptions: { key: string; label: string }[];
  onSaved: () => void;
  parentTaskId?: string;
  trigger?: React.ReactNode;
  task?: Task;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  allTasks: Task[];
  taskNo: Record<string, string>;
}) {
  void staff;
  const [openInner, setOpenInner] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInner;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setOpenInner;

  const defaultStatus = task?.status ?? statusOptions[0]?.key ?? "todo";
  const initialPicOrgs = (task?.pic_orgs && task.pic_orgs.length > 0)
    ? task.pic_orgs
    : (task?.pic_org ? [task.pic_org] : []);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [module, setModule] = useState(task?.module ?? "");
  const [site, setSite] = useState(task?.site ?? "");
  const [manDays, setManDays] = useState(task?.man_days?.toString() ?? "");
  const [startDate, setStartDate] = useState(task?.start_date ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [actual, setActual] = useState(task?.actual_completion_date ?? "");
  const [status, setStatus] = useState(defaultStatus);
  const [picOrgs, setPicOrgs] = useState<string[]>(initialPicOrgs);
  const [remark, setRemark] = useState(task?.remark ?? "");
  const [progress, setProgress] = useState<string>(task?.progress?.toString() ?? "0");
  const [predecessors, setPredecessors] = useState<string[]>(task?.predecessor_ids ?? []);

  // Parent selection state (only for new sub-task flow)
  const isEdit = !!task;
  // "existing" = pick from roots; "new" = create a new main task on submit; "none" = no parent (top-level)
  const initialParentMode: "existing" | "new" | "none" = parentTaskId ? "existing" : "none";
  const [parentMode, setParentMode] = useState<"existing" | "new" | "none">(initialParentMode);
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(parentTaskId);
  const [newParentTitle, setNewParentTitle] = useState("");

  // Reset form to blank defaults whenever the dialog opens for a NEW task.
  // Prevents stale values from a previous create or edit leaking into the next "New" click.
  useEffect(() => {
    if (!open || isEdit) return;
    setTitle("");
    setDescription("");
    setModule("");
    setSite("");
    setManDays("");
    setStartDate("");
    setDueDate("");
    setActual("");
    setStatus(statusOptions[0]?.key ?? "todo");
    setPicOrgs([]);
    setRemark("");
    setProgress("0");
    setPredecessors([]);
    setParentMode(parentTaskId ? "existing" : "none");
    setSelectedParentId(parentTaskId);
    setNewParentTitle("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const togglePicOrg = (name: string) => {
    setPicOrgs((prev) => prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]);
  };

  const hasChildren = useMemo(
    () => !!task && allTasks.some((t) => t.parent_task_id === task.id),
    [allTasks, task],
  );

  // Build a flat ordered list of candidate predecessor tasks, excluding self and own descendants
  const descendants = useMemo(() => {
    const set = new Set<string>();
    if (!task) return set;
    const queue = [task.id];
    while (queue.length) {
      const cur = queue.shift()!;
      set.add(cur);
      allTasks.forEach((t) => { if (t.parent_task_id === cur) queue.push(t.id); });
    }
    return set;
  }, [allTasks, task]);

  const candidates = useMemo(
    () => allTasks
      .filter((t) => !descendants.has(t.id))
      .sort((a, b) => (taskNo[a.id] ?? "").localeCompare(taskNo[b.id] ?? "", undefined, { numeric: true })),
    [allTasks, descendants, taskNo],
  );

  const togglePred = (id: string) => {
    setPredecessors((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description: description || null,
      module: module || null,
      site: site || null,
      man_days: manDays ? Number(manDays) : null,
      start_date: startDate || null,
      due_date: dueDate || null,
      actual_completion_date: actual || null,
      status,
      pic_org: picOrgs[0] ?? null,
      pic_orgs: picOrgs,
      remark: remark || null,
      progress: hasChildren ? 0 : Math.max(0, Math.min(100, Number(progress) || 0)),
      predecessor_ids: predecessors,
    };
    if (isEdit) {
      const { error } = await supabase.from("project_tasks").update(payload).eq("id", task!.id);
      if (error) return toast.error(error.message);
      toast.success("Saved");
    } else {
      // Resolve parent task id for the new row
      let resolvedParentId: string | null = null;
      if (parentTaskId) {
        if (parentMode === "existing") {
          resolvedParentId = selectedParentId ?? parentTaskId;
        } else if (parentMode === "new") {
          if (!newParentTitle.trim()) {
            return toast.error("Enter a name for the new main task");
          }
          const ins = await supabase.from("project_tasks").insert({
            project_id: projectId,
            parent_task_id: null,
            title: newParentTitle.trim(),
            status: "todo",
            priority: "normal",
            progress: 0,
            predecessor_ids: [],
            created_by: authorId,
          }).select("id").single();
          if (ins.error || !ins.data) return toast.error(ins.error?.message ?? "Failed to create main task");
          resolvedParentId = ins.data.id;
        }
      }
      const { error } = await supabase.from("project_tasks").insert({
        ...payload,
        project_id: projectId,
        parent_task_id: resolvedParentId,
        priority: "normal",
        created_by: authorId,
      });
      if (error) return toast.error(error.message);
      toast.success("Created");
    }
    setOpen(false);
    onSaved();
  };

  const showParentPicker = !isEdit && !!parentTaskId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : parentTaskId ? "New sub-task" : "New main task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {showParentPicker && (
            <div className="space-y-2 border rounded p-3 bg-muted/30">
              <Label>Main task</Label>
              <Select
                value={parentMode === "new" ? "__new__" : (selectedParentId ?? "")}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setParentMode("new");
                  } else {
                    setParentMode("existing");
                    setSelectedParentId(v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a main task" /></SelectTrigger>
                <SelectContent>
                  {roots.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {(taskNo[r.id] ?? "") + ". " + r.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New main task…</SelectItem>
                </SelectContent>
              </Select>
              {parentMode === "new" && (
                <Input
                  value={newParentTitle}
                  onChange={(e) => setNewParentTitle(e.target.value)}
                  placeholder="New main task title"
                  maxLength={200}
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Module</Label><Input value={module} onChange={(e) => setModule(e.target.value)} placeholder="e.g. Pre Implementation" maxLength={100} /></div>
            <div className="space-y-1"><Label>Site</Label><Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. DC & DR" maxLength={100} /></div>
          </div>
          <div className="space-y-1"><Label>Task title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-1"><Label>Description / details</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} placeholder="Bullet points or details" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Man-Days</Label><Input type="number" step="0.5" min="0" value={manDays} onChange={(e) => setManDays(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>PIC (Organization)</Label>
              <div className="border rounded p-2 space-y-1 max-h-32 overflow-y-auto">
                {orgs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground px-1 py-0.5">No organizations available.</p>
                ) : orgs.map((o) => {
                  const checked = picOrgs.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={checked} onChange={() => togglePicOrg(o)} className="h-3.5 w-3.5" />
                      <span className="truncate">{o}</span>
                    </label>
                  );
                })}
              </div>
              {picOrgs.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{picOrgs.join(", ")}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Est. Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Est. End</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Actual</Label><Input type="date" value={actual} onChange={(e) => setActual(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Remark</Label><Input value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={500} /></div>
          </div>
          <div className="space-y-1">
            <Label>Progress (%)</Label>
            {hasChildren ? (
              <p className="text-[11px] text-muted-foreground">Rolled up automatically from sub-tasks.</p>
            ) : (
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1">
            <Label>Depends on (predecessors)</Label>
            {candidates.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No other tasks available.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                {candidates.map((c) => {
                  const checked = predecessors.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={checked} onChange={() => togglePred(c.id)} className="h-3.5 w-3.5" />
                      <span className="text-muted-foreground tabular-nums w-10">{taskNo[c.id] ?? "—"}</span>
                      <span className="truncate flex-1">{c.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">This task starts after the selected predecessors complete.</p>
          </div>

          <DialogFooter><Button type="submit">{isEdit ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DragState = {
  taskId: string;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  origStart: Date;
  origEnd: Date;
  pxPerDay: number;
  dayDelta: number;
};

function GanttView({ tasks, childMap, projectStart, projectDue, canEdit, onChanged }: {
  tasks: Task[];
  childMap: Record<string, Task[]>;
  projectStart: string | null;
  projectDue: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Add start/end dates on tasks to see them on the Gantt chart.</p>;
  }

  const ROW_H = 36;
  const bars = tasks.map((t, idx) => {
    const endStr = t.due_date ?? t.start_date!;
    const startStr = t.start_date ?? t.due_date!;
    return {
      id: t.id, title: t.title, status: t.status,
      isParent: !t.parent_task_id,
      hasChildren: (childMap[t.id] ?? []).length > 0,
      predecessors: t.predecessor_ids ?? [],
      progress: effectiveProgress(t, childMap),
      idx,
      start: new Date(startStr), end: new Date(endStr),
      hasStart: !!t.start_date, hasEnd: !!t.due_date,
    };
  });
  const barIndex = new Map(bars.map((b) => [b.id, b]));

  const rangeStart = new Date(Math.min(
    projectStart ? new Date(projectStart).getTime() : Infinity,
    ...bars.map((b) => b.start.getTime())
  ));
  const rangeEnd = new Date(Math.max(
    projectDue ? new Date(projectDue).getTime() : -Infinity,
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

  const pctFor = (d: Date) => ((d.getTime() - rangeStart.getTime()) / DAY / totalDays) * 100;

  // Apply in-flight drag preview to displayed bar
  const displayBar = (b: typeof bars[number]) => {
    if (!drag || drag.taskId !== b.id) return { start: b.start, end: b.end };
    const days = drag.dayDelta;
    const ms = days * DAY;
    if (drag.mode === "move") return { start: new Date(drag.origStart.getTime() + ms), end: new Date(drag.origEnd.getTime() + ms) };
    if (drag.mode === "resize-start") {
      const ns = new Date(Math.min(drag.origStart.getTime() + ms, drag.origEnd.getTime()));
      return { start: ns, end: drag.origEnd };
    }
    const ne = new Date(Math.max(drag.origEnd.getTime() + ms, drag.origStart.getTime()));
    return { start: drag.origStart, end: ne };
  };

  const beginDrag = (e: React.PointerEvent, b: typeof bars[number], mode: DragState["mode"]) => {
    if (!canEdit || b.hasChildren) return; // don't drag rollup parents
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pxPerDay = rect.width / totalDays;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({
      taskId: b.id, mode, startX: e.clientX,
      origStart: b.start, origEnd: b.end,
      pxPerDay, dayDelta: 0,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const days = Math.round((e.clientX - drag.startX) / drag.pxPerDay);
    if (days !== drag.dayDelta) setDrag({ ...drag, dayDelta: days });
  };

  const onPointerUp = async () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.dayDelta === 0) return;
    const bar = barIndex.get(d.taskId);
    if (!bar) return;
    const ms = d.dayDelta * DAY;
    let newStart = bar.start, newEnd = bar.end;
    if (d.mode === "move") { newStart = new Date(d.origStart.getTime() + ms); newEnd = new Date(d.origEnd.getTime() + ms); }
    else if (d.mode === "resize-start") { newStart = new Date(Math.min(d.origStart.getTime() + ms, d.origEnd.getTime())); }
    else { newEnd = new Date(Math.max(d.origEnd.getTime() + ms, d.origStart.getTime())); }

    const patch: { start_date?: string; due_date?: string } = {};
    if (bar.hasStart || d.mode !== "resize-end") patch.start_date = toISODate(newStart);
    if (bar.hasEnd || d.mode !== "resize-start") patch.due_date = toISODate(newEnd);

    const { error } = await supabase.from("project_tasks").update(patch).eq("id", d.taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Schedule updated");
    onChanged();
  };

  // Dependency arrows using displayed positions
  const arrows: { fromX: number; fromY: number; toX: number; toY: number; key: string }[] = [];
  bars.forEach((b) => {
    const bd = displayBar(b);
    b.predecessors.forEach((pid) => {
      const p = barIndex.get(pid);
      if (!p) return;
      const pd = displayBar(p);
      arrows.push({
        key: `${pid}->${b.id}`,
        fromX: pctFor(pd.end),
        fromY: p.idx * ROW_H + ROW_H / 2,
        toX: pctFor(bd.start),
        toY: b.idx * ROW_H + ROW_H / 2,
      });
    });
  });

  const svgHeight = bars.length * ROW_H;

  return (
    <div className="min-w-[800px]" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="flex">
        <div className="w-64 shrink-0 text-xs font-semibold text-muted-foreground px-2 py-1.5">Task</div>
        <div className="flex-1 relative h-8 border-b">
          {ticks.map((t, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-dashed border-muted text-[10px] text-muted-foreground pl-1"
              style={{ left: `${t.left}%` }}>
              {t.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex">
        <div className="w-64 shrink-0">
          {bars.map((b) => (
            <div key={b.id} className={cn("px-2 text-xs truncate flex items-center border-b border-muted/40", b.isParent && "font-semibold")}
              style={{ height: ROW_H }} title={b.title}>
              {!b.isParent && <span className="text-muted-foreground mr-1">↳</span>}
              {b.title}
            </div>
          ))}
        </div>
        <div className="flex-1 relative" ref={trackRef}>
          {todayPct !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-primary z-10" style={{ left: `${todayPct}%` }} />
          )}
          {bars.map((b) => {
            const { start, end } = displayBar(b);
            const left = pctFor(start);
            const width = Math.max(0.4, pctFor(end) - left);
            const draggable = canEdit && !b.hasChildren;
            const isDragging = drag?.taskId === b.id;
            return (
              <div key={b.id} className="relative border-b border-muted/40 hover:bg-muted/20" style={{ height: ROW_H }}>
                <div
                  onPointerDown={(e) => beginDrag(e, b, "move")}
                  className={cn(
                    "absolute top-1.5 bottom-1.5 rounded text-[10px] flex items-center text-white shadow-sm overflow-hidden select-none",
                    b.status === "done" ? "bg-emerald-500/30" :
                    b.status === "blocked" ? "bg-destructive/30" :
                    b.status === "in_progress" ? "bg-blue-500/30" :
                    "bg-slate-400/30",
                    b.isParent && "ring-1 ring-foreground/30",
                    draggable && "cursor-grab active:cursor-grabbing",
                    isDragging && "ring-2 ring-primary",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${b.title} · ${start.toDateString()} → ${end.toDateString()} · ${b.progress}%${draggable ? " · drag to reschedule" : ""}`}
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-l pointer-events-none",
                      b.progress >= 100 ? "bg-emerald-500" :
                      b.status === "blocked" ? "bg-destructive" :
                      b.status === "in_progress" ? "bg-blue-500" :
                      b.status === "done" ? "bg-emerald-500" :
                      "bg-slate-500",
                    )}
                    style={{ width: `${b.progress}%` }}
                  />
                  <span className="relative truncate px-1.5 mix-blend-luminosity pointer-events-none">{b.title} · {b.progress}%</span>
                  {draggable && (
                    <>
                      <div
                        onPointerDown={(e) => beginDrag(e, b, "resize-start")}
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-foreground/30"
                      />
                      <div
                        onPointerDown={(e) => beginDrag(e, b, "resize-end")}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-foreground/30"
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {/* Dependency arrows overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height={svgHeight}
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${svgHeight}`}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <g className="text-muted-foreground" stroke="currentColor" strokeWidth="0.15" fill="none">
              {arrows.map((a) => {
                const midX = Math.max(a.fromX + 1.2, a.toX - 1.2);
                const d = `M ${a.fromX} ${a.fromY} L ${midX} ${a.fromY} L ${midX} ${a.toY} L ${a.toX} ${a.toY}`;
                return <path key={a.key} d={d} markerEnd="url(#arrow)" />;
              })}
            </g>
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-slate-400" /> To do</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-blue-500" /> In progress</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500" /> Done</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-destructive" /> Blocked</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 inline-flex items-center justify-center">→</span> Dependency</span>
        {todayPct !== null && <span className="flex items-center gap-1"><span className="h-3 w-px bg-primary" /> Today</span>}
        {canEdit && <span className="ml-auto italic">Tip: drag a bar to shift, or drag its edges to resize.</span>}
      </div>
    </div>
  );
}
