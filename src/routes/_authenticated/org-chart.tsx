import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ZoomIn, ZoomOut, Maximize2, Image as ImageIcon, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Node = Profile & { children: Node[]; mentees: Node[] };

function buildTree(list: Profile[], priorityOf: (title: string | null) => number): Node[] {
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
  const sortFn = (a: Node, b: Node) => {
    const pa = priorityOf(a.job_title);
    const pb = priorityOf(b.job_title);
    if (pa !== pb) return pa - pb;
    const da = a.start_date ? new Date(a.start_date).getTime() : Infinity;
    const db = b.start_date ? new Date(b.start_date).getTime() : Infinity;
    if (da !== db) return da - db;
    return a.full_name.localeCompare(b.full_name);
  };
  const sortRec = (n: Node) => {
    n.children.sort(sortFn);
    n.mentees.sort(sortFn);
    n.children.forEach(sortRec);
    n.mentees.forEach(sortRec);
  };
  roots.sort(sortFn);
  roots.forEach(sortRec);
  return roots;
}

const BRAND = "#1f6fd1";
const CARD_LEFT_INSET = 29;

function PhotoFrame({ src, name }: { src: string | null; name: string }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="relative w-[88px] h-[88px] rounded-[14px] overflow-hidden shrink-0"
      style={{ border: `4px solid ${BRAND}`, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" crossOrigin="anonymous" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-semibold text-xl"
          style={{ background: BRAND }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function PersonBlock({ node, dashed = false }: { node: Node; dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center w-[160px]">
      <div className={dashed ? "opacity-95" : ""}>
        <PhotoFrame src={node.avatar_url} name={node.full_name} />
      </div>
      <div className="mt-2 font-bold text-[13px] leading-tight text-foreground">{node.full_name}</div>
      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
        {(() => {
          const t = node.job_title ?? "—";
          const parts = t.trim().split(/\s+/);
          if (parts.length < 2) return t;
          const last = parts.pop();
          return (
            <>
              {parts.join(" ")}
              <br />
              {last}
            </>
          );
        })()}
      </div>
    </div>
  );
}

/** Vertical solid line ending in a downward arrowhead. */
function DownArrow({ height = 28 }: { height?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ height }}>
      <div className="flex-1 border-l-2" style={{ borderColor: BRAND }} />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `7px solid ${BRAND}`,
          marginTop: -1,
        }}
      />
    </div>
  );
}

/** Mentee chain: vertical line drops from parent center, then turns right into each mentee with arrow. */
function MenteeChain({ nodes }: { nodes: Node[] }) {
  if (!nodes.length) return null;
  if (nodes.length === 1) {
    return (
      <div className="flex flex-col items-center">
        <DownArrow />
        <PersonBlock node={nodes[0]} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-stretch mt-2 self-start" style={{ marginLeft: 79 }}>
      {nodes.map((m, i) => {
        const isLast = i === nodes.length - 1;
        return (
          <div key={m.id} className="relative flex items-start" style={{ marginTop: i === 0 ? 0 : 18 }}>
            {/* Vertical spine: top half (always) connects from above */}
            <div
              className="absolute left-0 top-0"
              style={{ width: 2, height: 44, background: BRAND }}
            />
            {/* Spine bottom half continues only if more mentees follow */}
            {!isLast && (
              <div
                className="absolute left-0"
                style={{ width: 2, top: 44, bottom: -18, background: BRAND }}
              />
            )}
            {/* Horizontal arrow into the mentee card */}
            <div className="flex items-center" style={{ marginTop: 44 - 5, width: 28 }}>
              <div className="flex-1 border-t-2" style={{ borderColor: BRAND }} />
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderLeft: `7px solid ${BRAND}`,
                }}
              />
            </div>
            <div style={{ marginLeft: -CARD_LEFT_INSET }}>
              <PersonBlock node={m} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Group consecutive children sharing the same job_title together. */
function groupByPosition(children: Node[]): Node[][] {
  const groups: Node[][] = [];
  for (const c of children) {
    const last = groups[groups.length - 1];
    if (last && (last[0].job_title ?? "") === (c.job_title ?? "")) {
      last.push(c);
    } else {
      groups.push([c]);
    }
  }
  return groups;
}

/** Render siblings: single child = arrow down; multiple = vertical spine with right arrows. */
function SiblingRow({ nodes }: { nodes: Node[] }) {
  if (nodes.length === 1) {
    return (
      <div className="flex flex-col items-center">
        <DownArrow />
        <Subtree node={nodes[0]} />
      </div>
    );
  }
  // Vertical spine on the left; each child branches right with a horizontal arrow.
  return (
    <div className="flex flex-col items-stretch">
      {nodes.map((c, i) => {
        const isLast = i === nodes.length - 1;
        return (
          <div key={c.id} className="relative flex items-start" style={{ marginTop: i === 0 ? 0 : 18 }}>
            {/* Spine top half: from row top to photo center (44px) */}
            <div
              className="absolute left-0 top-0"
              style={{ width: 2, height: 44, background: BRAND }}
            />
            {/* Spine bottom half continues to next sibling (skip on last) */}
            {!isLast && (
              <div
                className="absolute left-0"
                style={{ width: 2, top: 44, bottom: -18, background: BRAND }}
              />
            )}
            {/* Horizontal arrow from spine into card */}
            <div className="flex items-center" style={{ marginTop: 44 - 5, width: 28 }}>
              <div className="flex-1 border-t-2" style={{ borderColor: BRAND }} />
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderLeft: `7px solid ${BRAND}`,
                }}
              />
            </div>
            <div style={{ marginLeft: -CARD_LEFT_INSET }}>
              <Subtree node={c} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Subtree({ node }: { node: Node }) {
  const groups = groupByPosition(node.children);
  return (
    <div className="flex flex-col items-center">
      <PersonBlock node={node} />
      {node.mentees.length > 0 && <MenteeChain nodes={node.mentees} />}
      {groups.map((g, i) => (
        <SiblingRow key={i} nodes={g} />
      ))}
    </div>
  );
}

function RootTree({ root }: { root: Node }) {
  const cols = root.children;
  return (
    <div className="flex flex-col items-center">
      <PersonBlock node={root} />
      {root.mentees.length > 0 && <MenteeChain nodes={root.mentees} />}
      {cols.length > 0 && (
        <>
          {/* drop from root */}
          <div className="h-6 border-l-2" style={{ borderColor: BRAND }} />
          {/* horizontal spreader: each top-level report becomes a column */}
          <div className="flex items-start">
            {cols.map((c, i) => {
              const first = i === 0;
              const last = i === cols.length - 1;
              return (
                <div key={c.id} className="flex flex-col items-center" style={{ minWidth: 200 }}>
                  <div className="flex w-full h-0">
                    <div className="flex-1" style={{ borderTop: first ? "none" : `2px solid ${BRAND}` }} />
                    <div className="flex-1" style={{ borderTop: last ? "none" : `2px solid ${BRAND}` }} />
                  </div>
                  <DownArrow height={24} />
                  <Subtree node={c} />
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
  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: async () => (await supabase.from("positions").select("name,priority")).data ?? [],
  });
  const priorityOf = useMemo(() => {
    const m = new Map<string, number>();
    (positions ?? []).forEach((p: any) => m.set((p.name ?? "").toLowerCase(), p.priority ?? 999));
    return (title: string | null) => m.get((title ?? "").toLowerCase()) ?? 999;
  }, [positions]);
  const tree = useMemo(() => buildTree(data ?? [], priorityOf), [data, priorityOf]);
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
          <div className="overflow-auto max-h-[80vh]">
            <div
              ref={chartRef}
              className="min-w-max p-10 origin-top transition-transform"
              style={{ transform: `scale(${zoom})`, background: "#ffffff" }}
            >
              {/* Title banner */}
              <div className="flex items-center gap-4 mb-10 px-4">
                <div className="flex-1 h-[2px]" style={{ background: BRAND }} />
                <div
                  className="px-8 py-3 rounded-2xl text-white font-semibold text-lg text-center leading-tight shadow"
                  style={{ background: BRAND }}
                >
                  Department<br />Structure
                </div>
                <div className="flex-1 h-[2px]" style={{ background: BRAND }} />
              </div>

              <div className="flex gap-12 justify-center">
                {tree.map((root) => (
                  <RootTree key={root.id} root={root} />
                ))}
              </div>
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
