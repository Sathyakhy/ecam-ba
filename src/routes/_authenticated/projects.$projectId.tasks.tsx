import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2, MessageSquare, Paperclip, Search, X, Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";
import { TASK_STATUS_META, TASK_COLUMNS, PRIORITY_META, metaEntries, formatDate } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { downloadCSV, printAsPDF, escapeHTML } from "@/lib/project-exports";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/projects/$projectId/tasks")({
  component: TasksPage,
});

type Task = {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
};

function TasksPage() {
  const { projectId } = Route.useParams();
  const { project, staff, canManage, isMember, profile } = useProject(projectId);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>();
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["project-tasks-full", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_tasks").select("*").eq("project_id", projectId)
        .is("deleted_at", null)
        .order("order_index").order("created_at");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const canCreate = canManage || isMember;

  const rootTasks = useMemo(() => (tasks.data ?? []).filter((t) => !t.parent_task_id), [tasks.data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rootTasks.filter((t) => {
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rootTasks, query, assigneeFilter, priorityFilter]);

  const hasFilters = !!(query || assigneeFilter || priorityFilter);

  if (!project.data) return null;

  const onStatusChange = async (taskId: string, status: string) => {
    const { error } = await supabase.from("project_tasks").update({ status }).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-tasks-full", projectId] });
  };

  const exportTasksCSV = () => {
    const rows = (tasks.data ?? []).map((t) => ({
      title: t.title,
      status: TASK_STATUS_META[t.status]?.label ?? t.status,
      priority: PRIORITY_META[t.priority]?.label ?? t.priority,
      assignee: staff.data?.find((s) => s.id === t.assignee_id)?.full_name ?? "",
      start_date: t.start_date ?? "",
      due_date: t.due_date ?? "",
      parent: (tasks.data ?? []).find((p) => p.id === t.parent_task_id)?.title ?? "",
      description: t.description ?? "",
    }));
    const name = (project.data?.name ?? "project").replace(/[^a-z0-9-_]+/gi, "_");
    downloadCSV(`${name}-tasks.csv`, rows);
  };

  const exportTasksPDF = () => {
    const list = (tasks.data ?? []);
    const rowsHTML = list.map((t) => {
      const assignee = staff.data?.find((s) => s.id === t.assignee_id)?.full_name ?? "—";
      return `<tr>
        <td>${escapeHTML(t.title)}</td>
        <td><span class="badge">${escapeHTML(TASK_STATUS_META[t.status]?.label ?? t.status)}</span></td>
        <td>${escapeHTML(PRIORITY_META[t.priority]?.label ?? t.priority)}</td>
        <td>${escapeHTML(assignee)}</td>
        <td>${escapeHTML(t.due_date ?? "—")}</td>
      </tr>`;
    }).join("");
    const body = `
      <h1>${escapeHTML(project.data?.name ?? "Project")} — Tasks</h1>
      <div class="meta">${list.length} tasks · exported ${new Date().toLocaleString()}</div>
      <table><thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>`;
    printAsPDF(`${project.data?.name ?? "Project"} — Tasks`, body);
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search tasks…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-7" />
        </div>
        <Select value={assigneeFilter} onValueChange={(v) => setAssigneeFilter(v || undefined)}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All assignees" /></SelectTrigger>
          <SelectContent>
            {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v || undefined)}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            {metaEntries(PRIORITY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setAssigneeFilter(undefined); setPriorityFilter(undefined); }}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
        {canCreate && (
          <NewTaskDialog
            projectId={projectId}
            authorId={profile?.id ?? ""}
            staff={staff.data ?? []}
            onCreated={() => qc.invalidateQueries({ queryKey: ["project-tasks-full", projectId] })}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9"><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportTasksCSV()}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Excel-compatible (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportTasksPDF()}>
              <FileText className="h-3.5 w-3.5 mr-2" /> PDF (print)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => t.status === col);
          const meta = TASK_STATUS_META[col];
          return (
            <div key={col} className="rounded-lg border bg-muted/30 p-2 min-h-[200px]">
              <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {colTasks.map((t) => {
                  const assignee = staff.data?.find((s) => s.id === t.assignee_id);
                  const priorityMeta = PRIORITY_META[t.priority] ?? PRIORITY_META.normal;
                  const overdue = t.due_date && t.status !== "done" && new Date(t.due_date) < new Date();
                  const subtaskCount = (tasks.data ?? []).filter((x) => x.parent_task_id === t.id).length;
                  return (
                    <Card
                      key={t.id}
                      className="p-3 cursor-pointer hover:border-primary/40 transition"
                      onClick={() => setOpenTaskId(t.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium leading-tight flex-1">{t.title}</p>
                        <Badge variant={priorityMeta.variant} className="text-[9px] shrink-0">{priorityMeta.label}</Badge>
                      </div>
                      {t.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{t.description}</p>}
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {t.due_date && (
                            <span className={cn(overdue && "text-destructive font-medium")}>
                              {formatDate(t.due_date)}
                            </span>
                          )}
                          {subtaskCount > 0 && <span>· {subtaskCount} subtask{subtaskCount === 1 ? "" : "s"}</span>}
                        </div>
                        {assignee && (
                          <Avatar className="h-5 w-5">
                            {assignee.avatar_url && <AvatarImage src={assignee.avatar_url} />}
                            <AvatarFallback className="text-[9px]">{assignee.full_name.slice(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    </Card>
                  );
                })}
                {colTasks.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openTaskId && (
        <TaskDialog
          taskId={openTaskId}
          projectId={projectId}
          open={!!openTaskId}
          onOpenChange={(o) => !o && setOpenTaskId(null)}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}

function NewTaskDialog({ projectId, authorId, staff, onCreated, parentTaskId, trigger }: {
  projectId: string;
  authorId: string;
  staff: { id: string; full_name: string }[];
  onCreated: () => void;
  parentTaskId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New task</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{parentTaskId ? "New subtask" : "New task"}</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("project_tasks").insert({
              project_id: projectId,
              parent_task_id: parentTaskId ?? null,
              title, description: description || null,
              priority, status: "todo",
              assignee_id: assigneeId ?? null,
              due_date: dueDate || null,
              created_by: authorId,
            });
            if (error) return toast.error(error.message);
            toast.success("Task created");
            setOpen(false);
            setTitle(""); setDescription(""); setPriority("normal");
            setAssigneeId(undefined); setDueDate("");
            onCreated();
          }}
          className="space-y-4"
        >
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metaEntries(PRIORITY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v || undefined)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ taskId: initialTaskId, projectId, open, onOpenChange, onStatusChange }: {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStatusChange: (id: string, s: string) => void;
}) {
  const [stack, setStack] = useState<string[]>([initialTaskId]);
  const taskId = stack[stack.length - 1];
  const openSubtask = (id: string) => setStack((s) => [...s, id]);
  const goBack = () => setStack((s) => s.length > 1 ? s.slice(0, -1) : s);
  const qc = useQueryClient();
  const { staff, canManage, profile } = useProject(projectId);

  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_tasks").select("*").eq("id", taskId).single();
      if (error) throw error;
      return data as Task;
    },
  });

  const subtasks = useQuery({
    queryKey: ["task-subtasks", taskId],
    queryFn: async () => (await supabase.from("project_tasks").select("*").eq("parent_task_id", taskId).is("deleted_at", null)
      .order("created_at")).data as Task[] ?? [],
  });

  const comments = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => (await supabase.from("project_task_comments").select("*").eq("task_id", taskId)
      .order("created_at")).data ?? [],
  });

  const attachments = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => (await supabase.from("project_task_attachments").select("*").eq("task_id", taskId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const [commentBody, setCommentBody] = useState("");
  const [uploading, setUploading] = useState(false);

  if (!task.data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><p className="text-sm text-muted-foreground">Loading…</p></DialogContent>
      </Dialog>
    );
  }

  const t = task.data;
  const assignee = staff.data?.find((s) => s.id === t.assignee_id);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || !profile?.id) return;
    const { error } = await supabase.from("project_task_comments").insert({
      task_id: taskId, project_id: projectId, author_id: profile.id, body: commentBody,
    });
    if (error) return toast.error(error.message);
    setCommentBody("");
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  const handleUpload = async (file: File) => {
    if (!profile?.id) return;
    setUploading(true);
    const path = `${projectId}/${taskId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("project-attachments").upload(path, file);
    if (up.error) { setUploading(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("project_task_attachments").insert({
      task_id: taskId, project_id: projectId, uploader_id: profile.id,
      file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded");
    qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
  };

  const downloadAttachment = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {stack.length > 1 && (
            <button onClick={goBack} className="text-[11px] text-muted-foreground hover:text-foreground text-left mb-1">← Back to parent</button>
          )}
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground mb-1">Status</p>
              <Select value={t.status} onValueChange={(v) => onStatusChange(t.id, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metaEntries(TASK_STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Priority</p>
              <Badge variant={(PRIORITY_META[t.priority] ?? PRIORITY_META.normal).variant}>
                {(PRIORITY_META[t.priority] ?? PRIORITY_META.normal).label}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Assignee</p>
              <p className="font-medium">{assignee?.full_name ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Due</p>
              <p>{formatDate(t.due_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Created</p>
              <p>{formatDate(t.created_at)}</p>
            </div>
            <div className="flex items-end justify-end gap-1">
              {(canManage || t.created_by === profile?.id) && (
                <Button size="sm" variant="ghost" className="h-7"
                  onClick={async () => {
                    const { id, created_at, updated_at, ...rest } = t as any;
                    void id; void created_at; void updated_at;
                    const { error } = await supabase.from("project_tasks").insert({
                      ...rest,
                      title: `${t.title} (copy)`,
                      status: "todo",
                      created_by: profile?.id,
                      parent_task_id: t.parent_task_id,
                    });
                    if (error) return toast.error(error.message);
                    toast.success("Duplicated");
                    onOpenChange(false);
                    qc.invalidateQueries({ queryKey: ["project-tasks-full", projectId] });
                  }}>
                  <Copy className="h-3 w-3 mr-1" /> Duplicate
                </Button>
              )}
              {(canManage || t.created_by === profile?.id) && (
                <Button size="sm" variant="ghost" className="text-destructive h-7"
                  onClick={async () => {
                    if (!confirm("Delete this task?")) return;
                    const { error } = await supabase.from("project_tasks").delete().eq("id", t.id);
                    if (error) return toast.error(error.message);
                    toast.success("Deleted");
                    onOpenChange(false);
                    qc.invalidateQueries({ queryKey: ["project-tasks-full", projectId] });
                  }}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>
          </div>

          {t.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap bg-muted/40 p-3 rounded">{t.description}</p>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Subtasks</h3>
              <NewTaskDialog
                projectId={projectId}
                authorId={profile?.id ?? ""}
                staff={staff.data ?? []}
                parentTaskId={taskId}
                onCreated={() => qc.invalidateQueries({ queryKey: ["task-subtasks", taskId] })}
                trigger={<Button size="sm" variant="outline" className="h-7"><Plus className="h-3 w-3 mr-1" /> Add</Button>}
              />
            </div>
            <div className="space-y-1">
              {(subtasks.data ?? []).map((st) => {
                const stMeta = TASK_STATUS_META[st.status] ?? TASK_STATUS_META.todo;
                return (
                  <div key={st.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 hover:border-primary/40 transition">
                    <Badge variant={stMeta.variant} className="text-[9px]">{stMeta.label}</Badge>
                    <button className="flex-1 truncate text-left hover:underline" onClick={() => openSubtask(st.id)}>
                      {st.title}
                    </button>
                    <Select value={st.status} onValueChange={async (v) => {
                      await supabase.from("project_tasks").update({ status: v }).eq("id", st.id);
                      qc.invalidateQueries({ queryKey: ["task-subtasks", taskId] });
                    }}>
                      <SelectTrigger className="h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {metaEntries(TASK_STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {(subtasks.data ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> Attachments</h3>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) handleUpload(f);
                  e.target.value = "";
                }} />
                <Button size="sm" variant="outline" className="h-7 pointer-events-none" disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </label>
            </div>
            <div className="space-y-1">
              {(attachments.data ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5">
                  <button className="flex-1 text-left truncate hover:underline" onClick={() => downloadAttachment(a.file_path, a.file_name)}>
                    {a.file_name}
                  </button>
                  <span className="text-muted-foreground text-[10px]">{a.file_size ? (a.file_size / 1024).toFixed(1) + " KB" : ""}</span>
                  {(a.uploader_id === profile?.id || canManage) && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => {
                      await supabase.storage.from("project-attachments").remove([a.file_path]);
                      await supabase.from("project_task_attachments").delete().eq("id", a.id);
                      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
                    }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  )}
                </div>
              ))}
              {(attachments.data ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">None</p>}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Comments</h3>
            <div className="space-y-2 mb-2">
              {(comments.data ?? []).map((c) => {
                const author = staff.data?.find((s) => s.id === c.author_id);
                return (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-6 w-6">
                      {author?.avatar_url && <AvatarImage src={author.avatar_url} />}
                      <AvatarFallback className="text-[10px]">{(author?.full_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 bg-muted/40 rounded p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{author?.full_name ?? "?"}</span>
                        <span className="text-muted-foreground text-[10px] ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                        {(c.author_id === profile?.id || canManage) && (
                          <button className="text-destructive text-[10px]" onClick={async () => {
                            await supabase.from("project_task_comments").delete().eq("id", c.id);
                            qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
                          }}>×</button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                );
              })}
              {(comments.data ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">No comments yet</p>}
            </div>
            <form onSubmit={postComment} className="flex gap-2">
              <Textarea
                placeholder="Add a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={2}
                maxLength={2000}
                className="text-xs"
              />
              <Button type="submit" size="sm" disabled={!commentBody.trim()}>Post</Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
