import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Node = Profile & { children: Node[]; mentees: Node[] };

function buildTree(list: Profile[]): Node[] {
  const map = new Map<string, Node>();
  list.forEach((p) => map.set(p.id, { ...p, children: [], mentees: [] }));
  const roots: Node[] = [];
  map.forEach((n) => {
    if (n.manager_id && map.has(n.manager_id)) {
      map.get(n.manager_id)!.children.push(n);
    } else {
      roots.push(n);
    }
    const mentorId = (n as any).mentor_id as string | null;
    if (mentorId && map.has(mentorId) && mentorId !== n.manager_id) {
      map.get(mentorId)!.mentees.push(map.get(n.id)!);
    }
  });
  return roots;
}

function NodeCard({ node, asMentee = false }: { node: Node; asMentee?: boolean }) {
  const initials = node.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const allChildren = [
    ...node.children.map((c) => ({ node: c, mentee: false })),
    ...node.mentees.map((c) => ({ node: c, mentee: true })),
  ];
  return (
    <div className="flex flex-col items-center">
      <Card className={`px-4 py-3 flex items-center gap-3 min-w-[200px] hover:shadow-md transition-shadow ${asMentee ? "border-dashed" : ""}`}>
        <Avatar className="h-10 w-10">
          {node.avatar_url && <AvatarImage src={node.avatar_url} alt={node.full_name} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-1.5">
            {node.full_name}
            {asMentee && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">mentee</span>}
          </div>
          <div className="text-xs text-muted-foreground truncate">{node.job_title ?? "—"}</div>
        </div>
      </Card>
      {allChildren.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative pt-0">
            {allChildren.length > 1 && (
              <div className="absolute top-0 h-px bg-border" style={{ left: "10%", right: "10%" }} />
            )}
            <div className="flex gap-6 items-start">
              {allChildren.map(({ node: c, mentee }) => (
                <div key={`${mentee ? "m" : "c"}-${c.id}`} className="flex flex-col items-center">
                  <div className={`w-px h-6 ${mentee ? "bg-border/50 border-l border-dashed" : "bg-border"}`} />
                  <NodeCard node={c} asMentee={mentee} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OrgChartPage() {
  const { data } = useQuery({
    queryKey: ["org-chart"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("full_name")).data ?? [],
  });
  const tree = useMemo(() => buildTree(data ?? []), [data]);

  return (
    <div>
      <PageHeader title="Organization chart" description="Reporting structure across the department." />
      {tree.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No staff yet.</Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-12 justify-center min-w-max p-6">
            {tree.map((root) => (
              <NodeCard key={root.id} node={root} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/org-chart")({
  component: OrgChartPage,
});
