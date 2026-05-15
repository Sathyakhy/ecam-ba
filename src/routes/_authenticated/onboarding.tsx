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
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const STATUSES = ["pending", "in_progress", "completed"] as const;

function OnboardingPage() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine">(isAdmin ? "all" : "mine");

  const staffQ = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,username,start_date,status").order("full_name")).data ?? [],
  });

  const tasksQ = useQuery({
    queryKey: ["onboarding-all"],
    queryFn: async () => (await supabase.from("onboarding_tasks").select("*").order("order_index")).data ?? [],
  });

  const grouped = (staffQ.data ?? []).map((s) => {
    const tasks = (tasksQ.data ?? []).filter((t) => t.profile_id === s.id);
    const done = tasks.filter((t) => t.status === "completed").length;
    return { staff: s, tasks, done, total: tasks.length };
  }).filter((g) => filter === "all" ? true : g.staff.id === profile?.id);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("onboarding_tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["onboarding-all"] });
  };

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Track new staff onboarding progress and checklists."
        actions={
          <>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                <SelectItem value="mine">My checklist</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && <NewTaskDialog staff={staffQ.data ?? []} onCreated={() => qc.invalidateQueries({ queryKey: ["onboarding-all"] })} />}
          </>
        }
      />

      {grouped.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No onboarding records yet.
        </Card>
      )}

      <div className="space-y-4">
        {grouped.map(({ staff, tasks, done, total }) => (
          <Card key={staff.id} className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold">{staff.full_name} <span className="text-muted-foreground font-normal">@{staff.username}</span></h3>
                <p className="text-xs text-muted-foreground">
                  {staff.start_date ? `Started ${new Date(staff.start_date).toLocaleDateString()}` : "No start date"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={total && done === total ? "default" : "secondary"}>
                  {total ? `${done}/${total} complete` : "No tasks"}
                </Badge>
                <div className="w-32"><Progress value={total ? (done / total) * 100 : 0} /></div>
              </div>
            </div>
            {tasks.length > 0 ? (
              <ul className="divide-y divide-border">
                {tasks.map((t) => {
                  const canEdit = isAdmin || t.assignee_id === profile?.id || t.profile_id === profile?.id;
                  return (
                    <li key={t.id} className="py-3 flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.due_date && <span className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</span>}
                        <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)} disabled={!canEdit}>
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                            await supabase.from("onboarding_tasks").delete().eq("id", t.id);
                            qc.invalidateQueries({ queryKey: ["onboarding-all"] });
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned.</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewTaskDialog({ staff, onCreated }: { staff: { id: string; full_name: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [due, setDue] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId || !title) return;
    const { error } = await supabase.from("onboarding_tasks").insert({
      profile_id: profileId,
      title,
      description: desc || null,
      assignee_id: assignee || null,
      due_date: due || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Task added");
    setOpen(false); setTitle(""); setDesc(""); setDue(""); setAssignee(""); setProfileId("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New onboarding task</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>For staff member</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assignee (optional)</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
