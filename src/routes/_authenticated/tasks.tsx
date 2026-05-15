import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

const COLS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
] as const;

function TasksPage() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine">("mine");

  const tasks = useQuery({
    queryKey: ["tasks", filter, profile?.id],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (filter === "mine" && profile?.id) q = q.eq("assignee_id", profile.id);
      return (await q).data ?? [];
    },
  });
  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Track department work, deadlines and ownership."
        actions={
          <>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">My tasks</SelectItem>
                <SelectItem value="all">All tasks</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <NewTaskDialog
                staff={staff.data ?? []}
                onCreated={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
                createdBy={profile?.id ?? ""}
              />
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((col) => {
          const items = (tasks.data ?? []).filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[6rem]">
                {items.map((t) => {
                  const assignee = staff.data?.find((s) => s.id === t.assignee_id);
                  const canEdit = isAdmin || t.assignee_id === profile?.id || t.created_by === profile?.id;
                  return (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.title}</p>
                          {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" onClick={async () => {
                            await supabase.from("tasks").delete().eq("id", t.id);
                            qc.invalidateQueries({ queryKey: ["tasks"] });
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant={t.priority === "high" ? "destructive" : t.priority === "low" ? "outline" : "secondary"}>
                            {t.priority}
                          </Badge>
                          {t.due_date && <span className="text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</span>}
                        </div>
                        <span className="text-muted-foreground truncate max-w-[10ch]">{assignee?.full_name ?? "Unassigned"}</span>
                      </div>
                      {canEdit && (
                        <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                          <SelectTrigger className="h-7 text-xs mt-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </Card>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskDialog({ staff, onCreated, createdBy }: { staff: { id: string; full_name: string }[]; onCreated: () => void; createdBy: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("tasks").insert({
            title, description: desc || null, assignee_id: assignee || null,
            priority, due_date: due || null, created_by: createdBy || null,
          });
          if (error) return toast.error(error.message);
          toast.success("Task created");
          setOpen(false); setTitle(""); setDesc(""); setAssignee(""); setDue(""); setPriority("normal");
          onCreated();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Assignee</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
