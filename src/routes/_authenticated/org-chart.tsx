import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ZoomIn, ZoomOut, Maximize2, Image as ImageIcon, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Node = Profile & { children: Node[]; mentees: Node[] };

function buildTree(list: Profile[]): Node[] {
  const map = new Map<string, Node>();
  list.forEach((p) => map.set(p.id, { ...p, children: [], mentees: [] }));
  const roots: Node[] = [];
  map.forEach((n) => {
    const mentorId = (n as any).mentor_id as string | null;
    if (mentorId && map.has(mentorId)) {
      map.get(mentorId)!.mentees.push(n);
    } else if (n.manager_id && map.has(n.manager_id)) {
      map.get(n.manager_id)!.children.push(n);
    } else {
      roots.push(n);
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
  const multi = allChildren.length > 1;

  return (
    <div className="flex flex-col items-center">
      <Card
        className={`px-2.5 py-1.5 flex items-center gap-2 min-w-[160px] max-w-[180px] hover:shadow-md transition-shadow ${
          asMentee ? "border-dashed" : ""
        }`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          {node.avatar_url && <AvatarImage src={node.avatar_url} alt={node.full_name} />}
          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-xs truncate flex items-center gap-1">
            <span className="truncate">{node.full_name}</span>
            {asMentee && (
              <span className="text-[8px] uppercase tracking-wide text-muted-foreground shrink-0">m</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground truncate leading-tight">
            {node.job_title ?? "—"}
          </div>
        </div>
      </Card>

      {allChildren.length > 0 && (
        <>
          {/* drop from parent card to child group */}
          <div className="w-px h-5 bg-border" />

          <div className="flex items-start">
            {allChildren.map(({ node: c, mentee }, i) => {
              const first = i === 0;
              const last = i === allChildren.length - 1;
              return (
                <div
                  key={`${mentee ? "m" : "c"}-${c.id}`}
                  className="flex flex-col items-center px-3"
                >
                  {/* horizontal connector — only when there are siblings; spans only between first and last child centers */}
                  {multi && (
                    <div className="flex w-full h-0">
                      <div className={`flex-1 ${first ? "" : "border-t border-border"}`} />
                      <div className={`flex-1 ${last ? "" : "border-t border-border"}`} />
                    </div>
                  )}
                  {/* vertical stub down to the child card */}
                  <div
                    className={`h-5 ${
                      mentee ? "border-l border-dashed border-border" : "w-px bg-border"
                    }`}
                  />
                  <NodeCard node={c} asMentee={mentee} />
                </div>
              );
            })}
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
  const [zoom, setZoom] = useState(1);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  const reset = () => setZoom(1);

  const exportImage = async (kind: "jpeg" | "pdf") => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const { toJpeg } = await import("html-to-image");
      const dataUrl = await toJpeg(chartRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "jpeg") {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `org-chart-${stamp}.jpg`;
        a.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((res) => { img.onload = () => res(); });
        const orientation = img.width >= img.height ? "landscape" : "portrait";
        const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / img.width, pageH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        pdf.addImage(dataUrl, "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save(`org-chart-${stamp}.pdf`);
      }
      toast.success(`Exported ${kind.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Organization chart"
        description="Reporting structure across the department."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportImage("jpeg")} disabled={exporting}>
              <ImageIcon className="h-4 w-4 mr-1.5" />JPEG
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportImage("pdf")} disabled={exporting}>
              <FileDown className="h-4 w-4 mr-1.5" />PDF
            </Button>
          </>
        }
      />
      {tree.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No staff yet.</Card>
      ) : (
        <Card className="relative overflow-hidden">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-background/90 backdrop-blur border rounded-md p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] tabular-nums w-10 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} aria-label="Reset">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="overflow-auto max-h-[75vh]">
            <div
              ref={chartRef}
              className="flex gap-10 justify-center min-w-max p-8 origin-top transition-transform bg-background"
              style={{ transform: `scale(${zoom})` }}
            >
              {tree.map((root) => (
                <NodeCard key={root.id} node={root} />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/org-chart")({
  component: OrgChartPage,
});
