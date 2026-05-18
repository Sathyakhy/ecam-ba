import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; key: string; label: string; sort_order: number };

/**
 * Reusable admin manager for simple {key,label,sort_order} lookup tables
 * (task_statuses, task_priorities, task_modes).
 */
export function LookupManager({
  table,
  title,
  description,
}: {
  table: "task_statuses" | "task_priorities" | "task_modes";
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("id,key,label,sort_order")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: [table] });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newLabel.trim()) return toast.error("Key and label are required");
    const sort_order = Number(newOrder) || ((data?.length ?? 0) + 1) * 10;
    const { error } = await supabase.from(table).insert({ key, label: newLabel.trim(), sort_order });
    if (error) return toast.error(error.message);
    setNewKey(""); setNewLabel(""); setNewOrder("");
    toast.success("Added");
    refresh();
  };

  const updateRow = async (id: string, patch: { label?: string; sort_order?: number }) => {
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const removeRow = async (id: string, label: string) => {
    if (!confirm(`Delete "${label}"? Existing rows using this value will keep the value but it won't appear in pickers.`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Input className="h-8 w-28 text-xs font-mono" value={s.key} disabled title="Key (immutable)" />
              <Input
                className="h-8 flex-1 text-xs"
                defaultValue={s.label}
                onBlur={(e) => e.target.value !== s.label && updateRow(s.id, { label: e.target.value })}
              />
              <Input
                type="number"
                className="h-8 w-20 text-xs"
                defaultValue={s.sort_order}
                onBlur={(e) => Number(e.target.value) !== s.sort_order && updateRow(s.id, { sort_order: Number(e.target.value) })}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(s.id, s.label)}>Remove</Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="border-t pt-4 space-y-2">
        <Label className="text-xs">Add new</Label>
        <div className="flex items-center gap-2">
          <Input className="h-8 w-28 text-xs font-mono" placeholder="key" value={newKey} onChange={(e) => setNewKey(e.target.value)} maxLength={40} />
          <Input className="h-8 flex-1 text-xs" placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={60} />
          <Input className="h-8 w-20 text-xs" type="number" placeholder="Order" value={newOrder} onChange={(e) => setNewOrder(e.target.value)} />
          <Button type="submit" size="sm">Add</Button>
        </div>
      </form>
    </Card>
  );
}
