import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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

type UserRow = Tables<"profiles"> & { role: string };

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
  const update = useServerFn(adminUpdateUser);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      return (profiles.data ?? []).map((p) => ({
        ...p,
        role: roles.data?.find((r) => r.user_id === p.id)?.role ?? "staff",
      }));
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    username: "", full_name: "", email: "", password: "",
    job_title: "", department: "", role: "staff" as "admin" | "staff",
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
          role: form.role,
          manager_id: form.manager_id || null,
          start_date: form.start_date || null,
        },
      });
      toast.success("User created");
      setOpen(false);
      setForm({ username: "", full_name: "", email: "", password: "", job_title: "", department: "", role: "staff", manager_id: "", start_date: "" });
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
        description="Create staff accounts and manage department access."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-1" /> New user</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required pattern="[a-zA-Z0-9_.\-]+" minLength={3} maxLength={32} />
                  </div>
                  <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
                <div className="space-y-2"><Label>Initial password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={128} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} maxLength={120} /></div>
                  <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} maxLength={120} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "staff" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin / Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                </div>
                <DialogFooter><Button type="submit">Create user</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left">
            <tr className="[&>th]:py-3 [&>th]:px-4 text-xs uppercase text-muted-foreground tracking-wide">
              <th>User</th><th>Email</th><th>Role</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => {
              const initials = u.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
              <tr key={u.id} className="border-b border-border last:border-0 [&>td]:py-3 [&>td]:px-4">
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">@{u.username} · {u.job_title ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="text-muted-foreground">{u.email}</td>
                <td>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" && <ShieldCheck className="h-3 w-3 mr-1" />}{u.role}
                  </Badge>
                </td>
                <td><Badge variant="outline" className="capitalize">{u.status}</Badge></td>
                <td className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(u)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(u.id, u.full_name)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
              );
            })}
            {users.data?.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
