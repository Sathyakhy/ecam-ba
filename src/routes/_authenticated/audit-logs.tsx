import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: AuditPage,
});

type Row = {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  module: string;
  table_name: string;
  action: "insert" | "update" | "delete";
  record_id: string | null;
  summary: string | null;
  changed_fields: string[];
  old_data: unknown;
  new_data: unknown;
};

function AuditPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Inner />;
}

function Inner() {
  const [module, setModule] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs" as never)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const modules = useMemo(
    () => Array.from(new Set(data.map((d) => d.module))).sort(),
    [data]
  );

  const filtered = data.filter((r) => {
    if (module !== "all" && r.module !== module) return false;
    if (action !== "all" && r.action !== action) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !(r.summary?.toLowerCase().includes(s) ||
          r.actor_email?.toLowerCase().includes(s) ||
          r.table_name.toLowerCase().includes(s))
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Audit logs"
        description="Track who created, updated, or deleted records across modules."
      />

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search summary, user, table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="insert">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {filtered.length} of {data.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Module</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Record</th>
                <th className="py-2 pr-4">Changes</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="py-4 text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-muted-foreground">No entries.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {new Date(r.occurred_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">{r.actor_email ?? "—"}</td>
                  <td className="py-2 pr-4">{r.module}</td>
                  <td className="py-2 pr-4">
                    <Badge
                      variant={
                        r.action === "insert" ? "default" :
                        r.action === "delete" ? "destructive" : "secondary"
                      }
                    >
                      {r.action === "insert" ? "create" : r.action}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 max-w-[280px] truncate">{r.summary ?? r.table_name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {r.action === "update" ? r.changed_fields.join(", ") : r.table_name}
                  </td>
                  <td className="py-2 pr-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>
                            {r.action} · {r.table_name}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 text-xs">
                          <div><span className="text-muted-foreground">User: </span>{r.actor_email ?? r.actor_id ?? "system"}</div>
                          <div><span className="text-muted-foreground">Record ID: </span>{r.record_id ?? "—"}</div>
                          {r.changed_fields.length > 0 && (
                            <div><span className="text-muted-foreground">Changed: </span>{r.changed_fields.join(", ")}</div>
                          )}
                          {r.old_data != null && (
                            <div>
                              <div className="text-muted-foreground mb-1">Before</div>
                              <pre className="bg-muted rounded p-2 overflow-auto max-h-60">{JSON.stringify(r.old_data, null, 2)}</pre>
                            </div>
                          )}
                          {r.new_data != null && (
                            <div>
                              <div className="text-muted-foreground mb-1">After</div>
                              <pre className="bg-muted rounded p-2 overflow-auto max-h-60">{JSON.stringify(r.new_data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
