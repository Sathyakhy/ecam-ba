import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ImageUpload } from "@/components/image-upload";
import { useAuth } from "@/hooks/use-auth";
import { updateOwnProfile } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, refresh } = useAuth();
  const update = useServerFn(updateOwnProfile);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    department: "",
    avatar_url: "" as string | null,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        job_title: profile.job_title ?? "",
        department: profile.department ?? "",
        avatar_url: profile.avatar_url ?? null,
      });
    }
  }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await update({
        data: {
          full_name: form.full_name,
          job_title: form.job_title || null,
          department: form.department || null,
          avatar_url: form.avatar_url || null,
        },
      });
      await refresh();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="My profile" description="Update your personal details and profile picture." />
      <Card className="p-6 max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Profile picture</Label>
            <ImageUpload
              value={form.avatar_url}
              onChange={(url) => setForm({ ...form, avatar_url: url })}
              bucket="avatars"
              prefix={profile?.id ?? "me"}
              shape="circle"
              label="Upload photo"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={profile?.username ?? ""} disabled />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">Contact an admin to change your email or username.</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
