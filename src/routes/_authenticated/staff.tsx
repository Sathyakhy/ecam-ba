import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, UserPlus, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
});

function StaffPage() {
  const [q, setQ] = useState("");
  const { isAdmin } = useAuth();
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

  return (
    <div>
      <PageHeader
        title="Staff directory"
        description="Everyone in the department, with roles and reporting structure."
        actions={
          isAdmin ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-1.5" />Settings</Link>
              </Button>
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
                <Avatar><AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback></Avatar>
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
