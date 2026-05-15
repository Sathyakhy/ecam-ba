import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { Search, UserPlus, Download, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

function StaffPage() {
  const [q, setQ] = useState("");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const staff = useQuery({
    queryKey: ["staff-full"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const list = staff.data ?? [];
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter((p) =>
      p.full_name?.toLowerCase().includes(s) ||
      p.username?.toLowerCase().includes(s) ||
      p.job_title?.toLowerCase().includes(s) ||
      p.department?.toLowerCase().includes(s),
    );
  }, [staff.data, q]);

  const managerName = (id: string | null) => staff.data?.find((p) => p.id === id)?.full_name ?? "—";

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

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const list = staff.data ?? [];
      const byEmail = new Map(list.map((p) => [p.email?.toLowerCase(), p]));
      let updated = 0;
      let skipped = 0;
      for (const r of rows) {
        const email = String(r.email ?? "").trim().toLowerCase();
        const existing = byEmail.get(email);
        if (!existing) { skipped++; continue; }
        const managerEmail = String(r.manager_email ?? "").trim().toLowerCase();
        const manager_id = managerEmail ? (byEmail.get(managerEmail)?.id ?? null) : null;
        const patch: Record<string, any> = {
          full_name: r.full_name ?? existing.full_name,
          username: r.username ?? existing.username,
          job_title: r.job_title ?? null,
          department: r.department ?? null,
          status: r.status ?? existing.status,
          manager_id,
          start_date: r.start_date ? String(r.start_date).slice(0, 10) : null,
        };
        const { error } = await (supabase.from("profiles") as any).update(patch).eq("id", existing.id);
        if (error) { skipped++; } else { updated++; }
      }
      toast.success(`Imported: ${updated} updated, ${skipped} skipped`);
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
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, username, role…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Manager: {p.manager_id ? managerName(p.manager_id) : "—"}
                      {p.start_date && ` · Started ${new Date(p.start_date).toLocaleDateString()}`}
                    </p>
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
