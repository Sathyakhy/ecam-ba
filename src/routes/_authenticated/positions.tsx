import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Briefcase, Pencil, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/positions")({
  component: PositionsPage,
});

function PositionsPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editPriority, setEditPriority] = useState<number>(1);

  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: async () =>
      (await supabase.from("positions").select("*").order("priority").order("name")).data ?? [],
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const list = positions.data ?? [];
  const nextPriority = (list.reduce((m, p) => Math.max(m, p.priority ?? 0), 0) || 0) + 1;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("positions").insert({
      name: name.trim(),
      department: dept.trim() || null,
      priority: nextPriority,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Position added");
    setName(""); setDept("");
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  const remove = async (id: string, n: string) => {
    if (!confirm(`Remove "${n}"? Staff already using it keep their title.`)) return;
    const { error } = await supabase.from("positions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  const startEdit = (p: { id: string; name: string; department: string | null; priority: number }) => {
    setEditing(p.id); setEditName(p.name); setEditDept(p.department ?? ""); setEditPriority(p.priority ?? 1);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("positions").update({
      name: editName.trim(),
      department: editDept.trim() || null,
      priority: Math.max(1, Math.floor(editPriority || 1)),
    } as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  const swap = async (a: typeof list[number], b: typeof list[number]) => {
    // Two-step swap to avoid unique-priority collisions if you add a constraint later
    await supabase.from("positions").update({ priority: -1 } as never).eq("id", a.id);
    await supabase.from("positions").update({ priority: a.priority } as never).eq("id", b.id);
    await supabase.from("positions").update({ priority: b.priority } as never).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["positions"] });
  };

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Rank job titles by priority — 1 is the highest. Managers and mentors must outrank the staff they oversee."
      />

      <Card className="p-4 sm:p-5 mb-5">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Position name (e.g. Senior Engineer)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            className="flex-1"
          />
          <Input
            placeholder="Department (optional)"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            maxLength={120}
            className="sm:w-56"
          />
          <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">New positions get priority {nextPriority} — edit to rerank.</p>
      </Card>

      <Card className="divide-y divide-border">
        {list.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No positions yet. Add one above.
          </div>
        )}
        {list.map((p, idx) => {
          const isEditing = editing === p.id;
          return (
            <div key={p.id} className="p-3 sm:p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 font-semibold text-sm">
                {p.priority}
              </div>
              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
              {isEditing ? (
                <div className="flex-1 flex flex-col sm:flex-row gap-2 min-w-0">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Input value={editDept} onChange={(e) => setEditDept(e.target.value)} placeholder="Department" className="sm:w-44" />
                  <Input
                    type="number"
                    min={1}
                    value={editPriority}
                    onChange={(e) => setEditPriority(parseInt(e.target.value) || 1)}
                    placeholder="Priority"
                    className="sm:w-24"
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.department ?? "—"}</p>
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {!isEditing && (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={idx === 0} onClick={() => swap(p, list[idx - 1])}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={idx === list.length - 1} onClick={() => swap(p, list[idx + 1])}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {isEditing ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(p.id)}>
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(p.id, p.name)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
