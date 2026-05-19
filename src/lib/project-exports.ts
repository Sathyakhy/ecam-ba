// Lightweight, dependency-free exporters for project data.
// CSV opens cleanly in Excel; "PDF" uses the browser's native print dialog
// so users can pick "Save as PDF" without bundling a heavy PDF lib.

export function downloadCSV(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, filename);
    return;
  }
  const headers = Array.from(
    rows.reduce<Set<string>>((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set()),
  );
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : Array.isArray(v) ? v.join("; ") : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open a printable HTML window so users can "Save as PDF". */
export function printAsPDF(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHTML(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:32px;max-width:900px;margin:0 auto;}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:14px;margin:24px 0 8px;color:#334155;text-transform:uppercase;letter-spacing:.04em}
  .meta{color:#64748b;font-size:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-weight:600}
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#f1f5f9;font-size:11px}
  @media print {.no-print{display:none}}
</style></head><body>${bodyHTML}
<div class="no-print" style="margin-top:24px;display:flex;gap:8px;justify-content:flex-end">
  <button onclick="window.print()" style="padding:8px 14px;background:#0f172a;color:#fff;border:0;border-radius:6px;cursor:pointer">Print / Save as PDF</button>
</div>
</body></html>`);
  w.document.close();
}

export function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string,string>)[c]);
}
