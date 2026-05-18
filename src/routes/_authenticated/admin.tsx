import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { UserPlus, Trash2, ShieldCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ImageUpload } from "@/components/image-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { adminCreateUser, adminDeleteUser, adminUpdateUser } from "@/lib/auth.functions";
import type { Tables } from "@/integrations/supabase/types";

type UserRow = Tables<"profiles"> & {
  system_role_id: string | null;
  system_role_name: string | null;
};

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <AdminInner />;
}

function AdminInner() {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateUser);
  const del = useServerFn(adminDeleteUser);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, sysRoles, assigns] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("system_roles").select("id,name"),
        supabase.from("user_system_roles").select("user_id,role_id"),
      ]);
      const roleById = new Map((sysRoles.data ?? []).map((r) => [r.id, r.name]));
      return (profiles.data ?? []).map((p) => {
        const a = assigns.data?.find((x) => x.user_id === p.id);
        return {
          ...p,
          system_role_id: a?.role_id ?? null,
          system_role_name: a ? roleById.get(a.role_id) ?? null : null,
        };
      });
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "", full_name: "", email: "", password: "",
    job_title: "", department: "",
    manager_id: "", start_date: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({
        data: {
          username: form.username,
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          job_title: form.job_title || null,
          department: form.department || null,
          role: "staff",
          manager_id: form.manager_id || null,
          start_date: form.start_date || null,
        },
      });
      toast.success("User created");
      setOpen(false);
      setForm({ username: "", full_name: "", email: "", password: "", job_title: "", department: "", manager_id: "", start_date: "" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await del({ data: { user_id: id } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="User management"
        description="Create staff accounts and assign system roles."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-1" /> New user</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required pattern="[a-zA-Z0-9_.\-]+" minLength={3} maxLength={32} />
                  </div>
                  <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
                <div className="space-y-2"><Label>Initial password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={128} /></div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} maxLength={120} /></div>
                  <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} /></div>
                </div>
                <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Assign a system role after creation using the edit dialog.</p>
                <DialogFooter><Button type="submit">Create user</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left">
              <tr className="[&>th]:py-3 [&>th]:px-4 text-[11px] uppercase text-muted-foreground tracking-wider font-medium">
                <th>User</th>
                <th className="hidden md:table-cell">Email</th>
                <th>System role</th>
                <th className="hidden sm:table-cell">Status</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => {
                const initials = u.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
                return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors [&>td]:py-3 [&>td]:px-4">
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          @{u.username}
                          <span className="md:hidden"> · {u.email}</span>
                          {u.job_title && <span className="hidden md:inline"> · {u.job_title}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground hidden md:table-cell truncate max-w-[220px]">{u.email}</td>
                  <td>
                    {u.system_role_name ? (
                      <Badge variant="secondary" className="font-normal">
                        <ShieldCheck className="h-3 w-3 mr-1" />{u.system_role_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell"><Badge variant="outline" className="capitalize font-normal">{u.status}</Badge></td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(u)} aria-label={`Edit ${u.full_name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(u.id, u.full_name)} aria-label={`Delete ${u.full_name}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
                );
              })}
              {users.data?.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-12">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["admin-users"] });
            qc.invalidateQueries({ queryKey: ["staff-full"] });
          }}
        />
      )}
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(adminUpdateUser);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email,
    job_title: user.job_title ?? "",
    department: user.department ?? "",
    start_date: user.start_date ?? "",
    status: (user.status as "active" | "inactive") ?? "active",
    password: "",
    avatar_url: user.avatar_url ?? null as string | null,
  });
  const [saving, setSaving] = useState(false);

  const systemRoles = useQuery({
    queryKey: ["system_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("system_roles").select("id,name,access_level").order("name");
      return data ?? [];
    },
  });

  const [systemRoleId, setSystemRoleId] = useState<string>(user.system_role_id ?? "");
  useEffect(() => {
    setSystemRoleId(user.system_role_id ?? "");
  }, [user.system_role_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFn({
        data: {
          user_id: user.id,
          full_name: form.full_name,
          email: form.email,
          job_title: form.job_title || null,
          department: form.department || null,
          start_date: form.start_date || null,
          status: form.status,
          avatar_url: form.avatar_url,
          password: form.password || undefined,
        },
      });
      // Enforce exactly one system role: delete existing, insert if selected
      await supabase.from("user_system_roles").delete().eq("user_id", user.id);
      if (systemRoleId) {
        const { error } = await supabase
          .from("user_system_roles")
          .insert({ user_id: user.id, role_id: systemRoleId });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["user_system_roles"] });
      toast.success("User updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {user.full_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Profile picture</Label>
            <ImageUpload
              value={form.avatar_url}
              onChange={(url) => setForm({ ...form, avatar_url: url })}
              bucket="avatars"
              prefix={user.id}
              shape="circle"
              label="Upload photo"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} maxLength={120} /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Reset password (optional)</Label><Input type="text" placeholder="Leave blank to keep" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={form.password ? 8 : 0} maxLength={128} /></div>
          <div className="space-y-2">
            <Label>System role</Label>
            <Select value={systemRoleId || "__none"} onValueChange={(v) => setSystemRoleId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {(systemRoles.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} <span className="text-muted-foreground">({r.access_level === "view" ? "View" : "Edit"})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only one system role can be assigned per user. Manage roles in System Roles.</p>
          </div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
