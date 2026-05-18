import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ImageUpload } from "@/components/image-upload";
import { LookupManager } from "@/components/lookup-manager";
import { useAuth } from "@/hooks/use-auth";
import { getAppSettings, updateAppSettings } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const fetchFn = useServerFn(getAppSettings);
  const updateFn = useServerFn(updateAppSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchFn() });

  const [form, setForm] = useState({
    app_name: "",
    tagline: "",
    hero_title: "",
    hero_description: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm({
        app_name: data.settings.app_name ?? "",
        tagline: data.settings.tagline ?? "",
        hero_title: data.settings.hero_title ?? "",
        hero_description: data.settings.hero_description ?? "",
        logo_url: data.settings.logo_url ?? "",
      });
    }
  }, [data]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFn({
        data: { ...form, logo_url: form.logo_url.trim() || null },
      });
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Workspace settings" description="Branding shown on login and in the sidebar." />
      <Card className="p-6 max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>App name</Label>
              <Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} maxLength={60} required />
            </div>
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} maxLength={120} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Workspace logo</Label>
            <ImageUpload
              value={form.logo_url || null}
              onChange={(url) => setForm({ ...form, logo_url: url ?? "" })}
              bucket="branding"
              prefix="logo"
              label="Upload logo"
            />
          </div>
          <div className="space-y-2">
            <Label>Hero title (login page)</Label>
            <Input value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} maxLength={200} required />
          </div>
          <div className="space-y-2">
            <Label>Hero description (login page)</Label>
            <Textarea
              value={form.hero_description}
              onChange={(e) => setForm({ ...form, hero_description: e.target.value })}
              maxLength={600}
              rows={4}
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 max-w-2xl">
        <TaskStatusesManager />
      </div>
    </div>
  );
}

function TaskStatusesManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["task-statuses"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("task_statuses")
        .select("id,key,label,sort_order")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newOrder, setNewOrder] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["task-statuses"] });

  const addStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const { supabase } = await import("@/integrations/supabase/client");
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newLabel.trim()) return toast.error("Key and label are required");
    const sort_order = Number(newOrder) || ((data?.length ?? 0) + 1) * 10;
    const { error } = await supabase.from("task_statuses").insert({ key, label: newLabel.trim(), sort_order });
    if (error) return toast.error(error.message);
    setNewKey(""); setNewLabel(""); setNewOrder("");
    toast.success("Status added");
    refresh();
  };

  const updateRow = async (id: string, patch: { label?: string; sort_order?: number }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("task_statuses").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const deleteRow = async (id: string, label: string) => {
    if (!confirm(`Delete status "${label}"? Tasks still using it will keep the value but it won't appear in the picker.`)) return;
    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.from("task_statuses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Task statuses</h2>
        <p className="text-xs text-muted-foreground">Statuses shown in the project Timeline status picker.</p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Input
                className="h-8 w-28 text-xs font-mono"
                value={s.key}
                disabled
                title="Key (immutable)"
              />
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
              <Button type="button" size="sm" variant="ghost" onClick={() => deleteRow(s.id, s.label)}>Remove</Button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addStatus} className="border-t pt-4 space-y-2">
        <Label className="text-xs">Add new status</Label>
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
