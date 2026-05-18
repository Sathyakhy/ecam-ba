import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Paperclip, MessageSquare, Activity, Trash2, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  actual_completion_date: string | null;
  baseline_start?: string | null;
  baseline_finish?: string | null;
  actual_start?: string | null;
  task_mode?: string | null;
  module: string | null;
  site: string | null;
  man_days: number | null;
  remark: string | null;
  progress: number | null;
  pic_orgs: string[] | null;
  predecessor_ids: string[] | null;
};

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
  taskNo,
  allTasks,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  taskNo: Record<string, string>;
  allTasks: { id: string; title: string }[];
}) {
  const taskId = task?.id;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        {task ? (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] tabular-nums">#{taskNo[task.id] ?? "—"}</Badge>
                <Badge variant="secondary" className="text-[10px]">{task.status}</Badge>
                <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
              </div>
              <SheetTitle className="text-base leading-snug">{task.title}</SheetTitle>
              {task.module || task.site ? (
                <SheetDescription className="text-xs">
                  {[task.module, task.site].filter(Boolean).join(" · ")}
                </SheetDescription>
              ) : null}
            </SheetHeader>

            <DetailFacts task={task} allTasks={allTasks} taskNo={taskNo} />

            <Tabs defaultValue="comments" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="comments" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Comments</TabsTrigger>
                <TabsTrigger value="files" className="text-xs"><Paperclip className="h-3 w-3 mr-1" />Files</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs"><Activity className="h-3 w-3 mr-1" />Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="comments" className="mt-3">
                {taskId && <CommentsPanel taskId={taskId} projectId={task.project_id} />}
              </TabsContent>
              <TabsContent value="files" className="mt-3">
                {taskId && <AttachmentsPanel taskId={taskId} projectId={task.project_id} />}
              </TabsContent>
              <TabsContent value="activity" className="mt-3">
                {taskId && <ActivityPanel taskId={taskId} />}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailFacts({ task, allTasks, taskNo }: {
  task: Task;
  allTasks: { id: string; title: string }[];
  taskNo: Record<string, string>;
}) {
  const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString() : "—";
  const preds = (task.predecessor_ids ?? [])
    .map((id) => `#${taskNo[id] ?? "?"} ${allTasks.find((t) => t.id === id)?.title ?? ""}`)
    .filter(Boolean);

  const rows: [string, React.ReactNode][] = [
    ["Progress", `${task.progress ?? 0}%`],
    ["Man-days", task.man_days ?? "—"],
    ["Mode", task.task_mode ?? "auto"],
    ["PIC", (task.pic_orgs ?? []).join(", ") || "—"],
    ["Baseline start", fmt(task.baseline_start)],
    ["Baseline finish", fmt(task.baseline_finish)],
    ["Actual start", fmt(task.actual_start)],
    ["Actual finish", fmt(task.actual_completion_date)],
    ["Predecessors", preds.length ? preds.join("; ") : "—"],
  ];

  return (
    <div className="mt-4 space-y-3">
      {task.description && (
        <div className="text-xs whitespace-pre-wrap rounded border p-3 bg-muted/30">{task.description}</div>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right truncate">{v}</dd>
          </div>
        ))}
      </dl>
      {task.remark && (
        <div className="text-xs">
          <p className="text-muted-foreground mb-1">Remark</p>
          <p className="whitespace-pre-wrap rounded border p-2 bg-muted/30">{task.remark}</p>
        </div>
      )}
    </div>
  );
}

function CommentsPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_task_comments")
        .select("id, body, created_at, author_id")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const authorIds = Array.from(new Set((data ?? []).map((c) => c.author_id))).filter(Boolean);
  const { data: authors } = useQuery({
    queryKey: ["profiles-bulk", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,avatar_url").in("id", authorIds)).data ?? [],
  });
  const nameOf = (id: string) => authors?.find((a) => a.id === id)?.full_name ?? "Unknown";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !profile) return;
    setSending(true);
    const { error } = await supabase.from("project_task_comments").insert({
      task_id: taskId,
      project_id: projectId,
      author_id: profile.id,
      body: body.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    const { error } = await supabase.from("project_task_comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No comments yet.</p>
      ) : (
        <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {(data ?? []).map((c) => (
            <li key={c.id} className="rounded border p-2 text-xs space-y-1 group">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{nameOf(c.author_id)}</span>
                <div className="flex items-center gap-2">
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                  {profile?.id === c.author_id && (
                    <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Add a comment…"
          className="text-xs"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !body.trim()}>
            <Send className="h-3 w-3 mr-1" /> Post
          </Button>
        </div>
      </form>
    </div>
  );
}

function AttachmentsPanel({ taskId, projectId }: { taskId: string; projectId: string }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_task_attachments")
        .select("id, file_path, file_name, file_size, mime_type, uploader_id, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !profile) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${projectId}/${taskId}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("project-attachments").upload(path, file);
        if (up.error) { toast.error(up.error.message); continue; }
        const ins = await supabase.from("project_task_attachments").insert({
          task_id: taskId,
          project_id: projectId,
          uploader_id: profile.id,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        });
        if (ins.error) toast.error(ins.error.message);
      }
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from("project-attachments").remove([path]);
    const { error } = await supabase.from("project_task_attachments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Paperclip className="h-3 w-3 mr-1" />
          {uploading ? "Uploading…" : "Attach file(s)"}
        </Button>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No files yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {(data ?? []).map((f) => (
            <li key={f.id} className="rounded border p-2 text-xs flex items-center gap-2 group">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{f.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {f.file_size ? `${Math.round(f.file_size / 1024)} KB · ` : ""}
                  {new Date(f.created_at).toLocaleString()}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(f.file_path, f.file_name)}>
                <Download className="h-3 w-3" />
              </Button>
              {profile?.id === f.uploader_id && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(f.id, f.file_path)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_activity")
        .select("id, action, summary, created_at, actor_id, entity_type, entity_id")
        .eq("entity_id", taskId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorIds = Array.from(new Set((data ?? []).map((a) => a.actor_id))).filter(Boolean) as string[];
  const { data: actors } = useQuery({
    queryKey: ["profiles-bulk", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name").in("id", actorIds)).data ?? [],
  });
  const nameOf = (id?: string | null) => id ? (actors?.find((a) => a.id === id)?.full_name ?? "Unknown") : "System";

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if ((data ?? []).length === 0) return <p className="text-xs text-muted-foreground py-3">No activity recorded.</p>;

  return (
    <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
      {(data ?? []).map((a) => (
        <li key={a.id} className="text-xs flex items-start gap-2 rounded border p-2">
          <Activity className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="truncate">
              <span className="font-medium">{nameOf(a.actor_id)}</span>{" "}
              <span className="text-muted-foreground">{a.action.replace(/_/g, " ")}</span>
            </p>
            {a.summary && <p className="text-[11px] text-muted-foreground truncate">{a.summary}</p>}
            <p className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
