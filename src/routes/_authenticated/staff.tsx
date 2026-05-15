import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { Search, UserPlus, Download, Upload, Settings2, Mail, Calendar, Briefcase, Network } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminBulkImportStaff, adminUpdateUser } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

function tenure(start: string | null) {
  if (!start) return null;
  const s = new Date(start);
  const now = new Date();
  let months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  if (now.getDate() < s.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((now.getTime() - s.getTime()) / 86400000));
    return `${days}d`;
  }
  if (months < 12) return `${months}mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}y ${m}mo` : `${y}y`;
}

function StaffPage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("__all__");
  const [position, setPosition] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("__all__");
  const [sortBy, setSortBy] = useState<string>("name");
  const [editing, setEditing] = useState<Profile | null>(null);
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const staff = useQuery({
    queryKey: ["staff-full"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });

  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: async () => (await supabase.from("positions").select("*").order("name")).data ?? [],
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    (staff.data ?? []).forEach((p) => p.department && set.add(p.department));
    (positions.data ?? []).forEach((p) => p.department && set.add(p.department));
    return Array.from(set).sort();
  }, [staff.data, positions.data]);

  const filtered = useMemo(() => {
    let list = staff.data ?? [];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((p) =>
        p.full_name?.toLowerCase().includes(s) ||
        p.username?.toLowerCase().includes(s) ||
        p.job_title?.toLowerCase().includes(s) ||
        p.department?.toLowerCase().includes(s),
      );
    }
    if (dept !== "__all__") list = list.filter((p) => (p.department ?? "") === dept);
    if (position !== "__all__") list = list.filter((p) => (p.job_title ?? "") === position);
    if (status !== "__all__") list = list.filter((p) => p.status === status);
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_desc": return b.full_name.localeCompare(a.full_name);
        case "department": return (a.department ?? "").localeCompare(b.department ?? "") || a.full_name.localeCompare(b.full_name);
        case "newest": return (b.start_date ?? "").localeCompare(a.start_date ?? "");
        case "oldest": {
          const av = a.start_date ?? "9999"; const bv = b.start_date ?? "9999";
          return av.localeCompare(bv);
        }
        default: return a.full_name.localeCompare(b.full_name);
      }
    });
    return sorted;
  }, [staff.data, q, dept, position, status, sortBy]);

  const lookup = (id: string | null) => staff.data?.find((p) => p.id === id);
  const nameOf = (id: string | null) => lookup(id)?.full_name ?? "—";
  const initialsOf = (n: string) => n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    const rows = (staff.data ?? []).map((p) => ({
      full_name: p.full_name,
      username: p.username,
      email: p.email,
      job_title: p.job_title ?? "",
      department: p.department ?? "",
      status: p.status,
      manager_email: staff.data?.find((m) => m.id === p.manager_id)?.email ?? "",
      start_date: p.start_date ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, `staff-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const bulkImport = useServerFn(adminBulkImportStaff);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const rows = raw.map((r) => {
        let start_date: string | null = null;
        if (r.start_date != null && r.start_date !== "") {
          if (typeof r.start_date === "number") {
            const d = XLSX.SSF.parse_date_code(r.start_date);
            if (d) start_date = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          } else {
            start_date = String(r.start_date).slice(0, 10);
          }
        }
        return {
          full_name: String(r.full_name ?? "").trim(),
          username: String(r.username ?? "").trim(),
          email: String(r.email ?? "").trim(),
          job_title: r.job_title ? String(r.job_title).trim() : null,
          department: r.department ? String(r.department).trim() : null,
          status: (r.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
          manager_email: r.manager_email ? String(r.manager_email).trim() : null,
          start_date,
        };
      }).filter((r) => r.email && r.full_name && r.username);

      const res = await bulkImport({ data: { rows } });
      const msg = `Created ${res.created}, updated ${res.updated}` +
        (res.errors.length ? `, ${res.errors.length} errors` : "");
      toast.success(msg);
      if (res.errors.length) console.warn("Import errors", res.errors);
      if (res.tempPasswords.length) console.info("Temp passwords (share with users):", res.tempPasswords);
      qc.invalidateQueries({ queryKey: ["staff-full"] });
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff directory"
        description="Everyone in the department, with roles and reporting structure."
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1.5" />Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4 mr-1.5" />{importing ? "Importing…" : "Import"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
              />
              <Button asChild size="sm">
                <Link to="/admin"><UserPlus className="h-4 w-4 mr-1.5" />Add staff</Link>
              </Button>
            </>
          ) : null
        }
      />

      {/* Filter bar */}
      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-10" placeholder="Search by name, username, role…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Position" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All positions</SelectItem>
                {(positions.data ?? []).map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="newest">Newest hires</SelectItem>
                <SelectItem value="oldest">Longest tenure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} of {staff.data?.length ?? 0} {filtered.length === 1 ? "person" : "people"}</span>
            {(q || dept !== "__all__" || position !== "__all__" || status !== "__all__" || sortBy !== "name") && (
              <button className="text-primary hover:underline" onClick={() => { setQ(""); setDept("__all__"); setPosition("__all__"); setStatus("__all__"); setSortBy("name"); }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Staff grid */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const initials = initialsOf(p.full_name);
          const t = tenure(p.start_date);
          const manager = lookup(p.manager_id);
          const mentor = lookup((p as any).mentor_id);
          return (
            <Card key={p.id} className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow group">
              {/* Identity */}
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-border">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="font-semibold truncate flex-1">{p.full_name}</h3>
                    <Badge variant={p.status === "active" ? "secondary" : "outline"} className="text-[10px] h-5 capitalize shrink-0">
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  {p.job_title && (
                    <p className="text-sm text-foreground/80 mt-1 truncate">{p.job_title}</p>
                  )}
                </div>
              </div>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {p.department && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <Briefcase className="h-3 w-3" />{p.department}
                  </span>
                )}
                {t && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <Calendar className="h-3 w-3" />{t}
                  </span>
                )}
              </div>

              {/* Reporting */}
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Manager</p>
                  {manager ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar className="h-5 w-5 shrink-0">
                        {manager.avatar_url && <AvatarImage src={manager.avatar_url} />}
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initialsOf(manager.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{manager.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Mentor</p>
                  {mentor ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar className="h-5 w-5 shrink-0">
                        {mentor.avatar_url && <AvatarImage src={mentor.avatar_url} />}
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initialsOf(mentor.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{mentor.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <a href={`mailto:${p.email}`} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 min-w-0">
                  <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{p.email}</span>
                </a>
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setEditing(p)}>
                    <Settings2 className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
            <Network className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            No staff match your filters.
          </Card>
        )}
      </div>

      {editing && (
        <RelationshipDialog
          person={editing}
          staff={staff.data ?? []}
          positions={(positions.data ?? []).map((p) => p.name)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["staff-full"] });
          }}
        />
      )}
    </div>
  );
}

function RelationshipDialog({
  person, staff, positions, onClose, onSaved,
}: {
  person: Profile;
  staff: Profile[];
  positions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateUser = useServerFn(adminUpdateUser);
  const [managerId, setManagerId] = useState<string>(person.manager_id ?? "__none__");
  const [mentorId, setMentorId] = useState<string>((person as any).mentor_id ?? "__none__");
  const [jobTitle, setJobTitle] = useState<string>(person.job_title ?? "__none__");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (managerId === person.id || mentorId === person.id) {
      toast.error("Can't be their own manager or mentor");
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        data: {
          user_id: person.id,
          full_name: person.full_name,
          email: person.email,
          job_title: jobTitle === "__none__" ? null : jobTitle,
          department: person.department,
          manager_id: managerId === "__none__" ? null : managerId,
          mentor_id: mentorId === "__none__" ? null : mentorId,
          start_date: person.start_date,
          status: (person.status as "active" | "inactive") ?? "active",
          avatar_url: person.avatar_url,
        },
      });
      toast.success("Updated");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const others = staff.filter((s) => s.id !== person.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {person.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Position</Label>
            <Select value={jobTitle} onValueChange={setJobTitle}>
              <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {positions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Manage the position list in <Link to="/positions" className="text-primary hover:underline">Positions</Link>.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Direct line manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {others.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mentor</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {others.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
