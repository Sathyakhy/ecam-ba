import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { Search, UserPlus, Download, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminBulkImportStaff, adminUpdateUser } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

function StaffPage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("__all__");
  const [position, setPosition] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("__all__");
  const [sortBy, setSortBy] = useState<string>("name");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const staff = useQuery({
    queryKey: ["staff-full"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    (staff.data ?? []).forEach((p) => p.department && set.add(p.department));
    return Array.from(set).sort();
  }, [staff.data]);

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
  }, [staff.data, q, dept, status, sortBy]);

  const managerName = (id: string | null) => staff.data?.find((p) => p.id === id)?.full_name ?? "—";

  const tenure = (start: string | null) => {
    if (!start) return null;
    const s = new Date(start);
    const now = new Date();
    let months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
    if (now.getDate() < s.getDate()) months -= 1;
    if (months < 1) {
      const days = Math.max(0, Math.floor((now.getTime() - s.getTime()) / 86400000));
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
    const y = Math.floor(months / 12);
    const m = months % 12;
    return m ? `${y}y ${m}mo` : `${y} year${y === 1 ? "" : "s"}`;
  };

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
  const updateUser = useServerFn(adminUpdateUser);

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
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, username, role…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="name_desc">Name (Z–A)</SelectItem>
            <SelectItem value="department">Department</SelectItem>
            <SelectItem value="newest">Newest hires</SelectItem>
            <SelectItem value="oldest">Longest tenure</SelectItem>
          </SelectContent>
        </Select>
        {(q || dept !== "__all__" || status !== "__all__" || sortBy !== "name") && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setDept("__all__"); setStatus("__all__"); setSortBy("name"); }}>Clear</Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const initials = p.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name} />}
                  <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium truncate">{p.full_name}</h3>
                    <Badge variant={p.status === "active" ? "secondary" : "outline"} className="text-xs capitalize">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">@{p.username} · {p.email}</p>
                  <div className="mt-2 text-sm">
                    <p>{p.job_title ?? "—"}{p.department ? ` · ${p.department}` : ""}</p>
                    {(() => {
                      const updateField = async (field: "manager_id" | "mentor_id", v: string) => {
                        const value = v === "__none__" ? null : v;
                        if (value === p.id) { toast.error(`Can't be their own ${field === "manager_id" ? "manager" : "mentor"}`); return; }
                        try {
                          await updateUser({ data: {
                            user_id: p.id,
                            full_name: p.full_name,
                            email: p.email,
                            job_title: p.job_title,
                            department: p.department,
                            manager_id: field === "manager_id" ? value : p.manager_id,
                            mentor_id: field === "mentor_id" ? value : (p as any).mentor_id,
                            start_date: p.start_date,
                            status: (p.status as "active" | "inactive") ?? "active",
                            avatar_url: p.avatar_url,
                          }});
                          toast.success(`${field === "manager_id" ? "Manager" : "Mentor"} updated`);
                          qc.invalidateQueries({ queryKey: ["staff-full"] });
                        } catch (e: any) {
                          toast.error(e.message ?? "Update failed");
                        }
                      };
                      return isAdmin ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0 w-14">Manager:</span>
                            <Select value={p.manager_id ?? "__none__"} onValueChange={(v) => updateField("manager_id", v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select manager" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {(staff.data ?? []).filter((m) => m.id !== p.id).map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0 w-14">Mentor:</span>
                            <Select value={(p as any).mentor_id ?? "__none__"} onValueChange={(v) => updateField("mentor_id", v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Add mentor" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {(staff.data ?? []).filter((m) => m.id !== p.id).map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">Manager: {p.manager_id ? managerName(p.manager_id) : "—"}</p>
                          <p className="text-xs text-muted-foreground">Mentor: {(p as any).mentor_id ? managerName((p as any).mentor_id) : "—"}</p>
                        </>
                      );
                    })()}
                    {p.start_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Started {new Date(p.start_date).toLocaleDateString()}
                        {tenure(p.start_date) ? ` · ${tenure(p.start_date)} at company` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No staff match your search.</Card>
        )}
      </div>
    </div>
  );
}
