import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/system-roles")({
  component: SystemRolesPage,
});

export const SYSTEM_MODULES: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "onboarding", label: "Onboarding" },
  { key: "projects", label: "Projects" },
  { key: "learning", label: "Learning" },
  { key: "tasks", label: "Tasks" },
  { key: "staff", label: "Staff" },
  { key: "org-chart", label: "Org chart" },
  { key: "announcements", label: "Announcements" },
  { key: "profile", label: "My profile" },
  { key: "admin", label: "User management" },
  { key: "positions", label: "Positions" },
  { key: "project-config", label: "Project Config" },
  { key: "settings", label: "Settings" },
];

type SystemRole = {
  id: string;
  name: string;
  description: string | null;
  modules: string[];
  access_level: "view" | "edit";
};

function SystemRolesPage() {
  return (
    <div>
      <PageHeader
        title="System Roles"
        description="Define roles with allowed modules and assign them to users."
      />
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Roles
          </TabsTrigger>
          <TabsTrigger value="assignments">
            <Users className="h-3.5 w-3.5 mr-1" /> Assignments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4"><RolesTab /></TabsContent>
        <TabsContent value="assignments" className="mt-4"><AssignmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Roles ---------------- */

function RolesTab() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["system_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_roles").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as SystemRole[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["system_roles"] });

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <RoleDialog
            onSaved={invalidate}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New role</Button>}
          />
        </div>
      )}
      {(roles.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">
          No system roles yet.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(roles.data ?? []).map((r) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{r.name}</p>
                    <Badge variant={r.access_level === "view" ? "outline" : "default"} className="text-[10px] px-1.5 py-0">
                      {r.access_level === "view" ? "View" : "Edit"}
                    </Badge>
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <>
                    <RoleDialog
                      role={r}
                      onSaved={invalidate}
                      trigger={
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={async () => {
                        if (!confirm(`Delete role "${r.name}"?`)) return;
                        const { error } = await supabase.from("system_roles").delete().eq("id", r.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Role deleted"); invalidate(); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {r.modules.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No modules</span>
                ) : (
                  r.modules.map((m) => {
                    const mod = SYSTEM_MODULES.find((x) => x.key === m);
                    return <Badge key={m} variant="secondary" className="text-xs">{mod?.label ?? m}</Badge>;
                  })
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleDialog({
  role,
  trigger,
  onSaved,
}: {
  role?: SystemRole;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [modules, setModules] = useState<string[]>(role?.modules ?? []);
  const [accessLevel, setAccessLevel] = useState<"view" | "edit">(role?.access_level ?? "edit");
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) =>
    setModules((m) => (m.includes(key) ? m.filter((x) => x !== key) : [...m, key]));

  const save = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      modules,
      access_level: accessLevel,
    };
    const { error } = role
      ? await supabase.from("system_roles").update(payload).eq("id", role.id)
      : await supabase.from("system_roles").insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(role ? "Role updated" : "Role created");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "New system role"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Editor" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What can this role do?"
            />
          </div>
          <div className="space-y-1">
            <Label>Access level</Label>
            <div className="flex gap-2">
              <label className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm ${accessLevel === "view" ? "border-primary bg-primary/10" : "border-input"}`}>
                <input type="radio" className="sr-only" checked={accessLevel === "view"} onChange={() => setAccessLevel("view")} />
                View only
              </label>
              <label className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm ${accessLevel === "edit" ? "border-primary bg-primary/10" : "border-input"}`}>
                <input type="radio" className="sr-only" checked={accessLevel === "edit"} onChange={() => setAccessLevel("edit")} />
                Editable
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Modules</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 max-h-64 overflow-auto">
              {SYSTEM_MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={modules.includes(m.key)}
                    onCheckedChange={() => toggle(m.key)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Assignments ---------------- */

function AssignmentsTab() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const roles = useQuery({
    queryKey: ["system_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("system_roles").select("*").order("name");
      return (data ?? []) as SystemRole[];
    },
  });

  const profiles = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, job_title")
        .order("full_name");
      return data ?? [];
    },
  });

  const assignments = useQuery({
    queryKey: ["user_system_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_system_roles").select("*");
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["user_system_roles"] });

  const rolesByUser = new Map<string, string[]>();
  for (const a of assignments.data ?? []) {
    const arr = rolesByUser.get(a.user_id) ?? [];
    arr.push(a.role_id);
    rolesByUser.set(a.user_id, arr);
  }

  const toggleAssignment = async (userId: string, roleId: string, on: boolean) => {
    // Enforce a single role per user: clear any existing assignment first.
    await supabase.from("user_system_roles").delete().eq("user_id", userId);
    if (on) {
      const { error } = await supabase
        .from("user_system_roles")
        .insert({ user_id: userId, role_id: roleId });
      if (error) return toast.error(error.message);
    }
    invalidate();
  };

  if (!isAdmin) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Only admins can manage role assignments.
      </Card>
    );
  }

  if (!roles.data?.length) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Create a role first in the Roles tab.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground sm:hidden">Swipe horizontally to see all roles →</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                User
              </th>
              {roles.data.map((r) => (
                <th key={r.id} className="text-center px-3 py-2.5 font-medium whitespace-nowrap text-[11px] uppercase tracking-wider text-muted-foreground">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(profiles.data ?? []).map((p) => {
              const assigned = rolesByUser.get(p.id) ?? [];
              return (
                <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                    <div className="font-medium truncate max-w-[160px]">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email}</div>
                  </td>
                  {roles.data!.map((r) => {
                    const on = assigned.includes(r.id);
                    return (
                      <td key={r.id} className="text-center px-3 py-2">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) => toggleAssignment(p.id, r.id, !!v)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
