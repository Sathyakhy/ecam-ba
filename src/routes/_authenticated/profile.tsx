import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    nationality: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    bio: "",
  });

  useEffect(() => {
    if (profile) {
      const p = profile as typeof profile & {
        phone?: string | null; date_of_birth?: string | null; gender?: string | null;
        address?: string | null; nationality?: string | null;
        emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
        bio?: string | null;
      };
      setForm({
        full_name: profile.full_name ?? "",
        job_title: profile.job_title ?? "",
        department: profile.department ?? "",
        avatar_url: profile.avatar_url ?? null,
        phone: p.phone ?? "",
        date_of_birth: p.date_of_birth ?? "",
        gender: p.gender ?? "",
        address: p.address ?? "",
        nationality: p.nationality ?? "",
        emergency_contact_name: p.emergency_contact_name ?? "",
        emergency_contact_phone: p.emergency_contact_phone ?? "",
        bio: p.bio ?? "",
      });
    }
  }, [profile]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
          phone: form.phone || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          address: form.address || null,
          nationality: form.nationality || null,
          emergency_contact_name: form.emergency_contact_name || null,
          emergency_contact_phone: form.emergency_contact_phone || null,
          bio: form.bio || null,
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
      <Card className="p-6 max-w-3xl">
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label>Profile picture</Label>
            <ImageUpload
              value={form.avatar_url}
              onChange={(url) => set("avatar_url", url)}
              bucket="avatars"
              prefix={profile?.id ?? "me"}
              shape="circle"
              label="Upload photo"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Basic info</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={profile?.username ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => set("department", e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <Input value={profile?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">Contact an admin to change your email or username.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Personal info</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} placeholder="+855 12 345 678" />
              </div>
              <div className="space-y-2">
                <Label>Date of birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Input value={form.gender} onChange={(e) => set("gender", e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact name</Label>
                <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Emergency contact phone</Label>
                <Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} maxLength={40} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Short bio</Label>
                <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} maxLength={2000} rows={3} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
