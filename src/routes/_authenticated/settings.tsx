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
    </div>
  );
}
