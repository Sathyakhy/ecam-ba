import { escapeHTML } from "./project-exports";

export function openCertificate(opts: {
  recipientName: string;
  courseTitle: string;
  issuedAt: string | Date;
  certificateNo: string;
  organization?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}) {
  const date = new Date(opts.issuedAt).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Certificate - ${escapeHTML(opts.recipientName)}</title>
<style>
  @page { size: A4 landscape; margin: 0 }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,'Times New Roman',serif;background:#f6f3ec;padding:24px;display:flex;justify-content:center;min-height:100vh}
  .cert{width:1120px;max-width:100%;background:#fffdf7;border:14px double #c9a449;padding:56px 72px;position:relative;box-shadow:0 12px 48px rgba(0,0,0,.12)}
  .corner{position:absolute;width:60px;height:60px;border:3px solid #c9a449}
  .corner.tl{top:24px;left:24px;border-right:0;border-bottom:0}
  .corner.tr{top:24px;right:24px;border-left:0;border-bottom:0}
  .corner.bl{bottom:24px;left:24px;border-right:0;border-top:0}
  .corner.br{bottom:24px;right:24px;border-left:0;border-top:0}
  .eyebrow{text-align:center;letter-spacing:.4em;color:#9a7b1f;font-size:13px;text-transform:uppercase}
  h1{text-align:center;font-size:54px;margin:14px 0 6px;color:#1a2a4a;letter-spacing:.02em}
  .subtitle{text-align:center;color:#4a5568;font-size:16px;margin-bottom:36px}
  .presented{text-align:center;font-style:italic;color:#475569;font-size:15px}
  .name{text-align:center;font-size:42px;margin:14px 0 8px;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:10px;display:inline-block;min-width:60%;font-family:'Brush Script MT','Lucida Handwriting',cursive;font-weight:400}
  .name-wrap{text-align:center;margin:0 auto}
  .completed{text-align:center;color:#475569;margin-top:18px;font-size:15px}
  .course{text-align:center;font-size:24px;margin:10px 0 28px;color:#1a2a4a;font-weight:600}
  .footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:48px;gap:48px}
  .sig{flex:1;text-align:center}
  .sig .line{border-top:1px solid #475569;padding-top:6px;font-size:13px;color:#334155}
  .sig .who{font-weight:600;color:#0f172a}
  .seal{width:120px;height:120px;border:3px solid #c9a449;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9a7b1f;font-size:11px;text-align:center;line-height:1.3;padding:6px;text-transform:uppercase;letter-spacing:.1em}
  .cert-no{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font-size:11px;color:#94a3b8;letter-spacing:.15em}
  .no-print{margin-top:18px;text-align:center}
  @media print{.no-print{display:none}body{background:#fff;padding:0}.cert{box-shadow:none;border-width:10px}}
</style></head><body>
<div class="cert">
  <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
  <div class="eyebrow">${escapeHTML(opts.organization ?? "Certificate of Completion")}</div>
  <h1>Certificate of Completion</h1>
  <div class="subtitle">This certificate is proudly presented to</div>
  <div class="name-wrap"><div class="name">${escapeHTML(opts.recipientName)}</div></div>
  <div class="completed">for successfully completing the course</div>
  <div class="course">${escapeHTML(opts.courseTitle)}</div>
  <div class="footer">
    <div class="sig">
      <div class="line"><div class="who">${escapeHTML(opts.signatoryName ?? "Authorized Signatory")}</div>${escapeHTML(opts.signatoryTitle ?? "Program Lead")}</div>
    </div>
    <div class="seal">Awarded<br/><strong style="font-size:14px;color:#1a2a4a;letter-spacing:.04em">${escapeHTML(date)}</strong><br/>Verified</div>
    <div class="sig">
      <div class="line"><div class="who">${escapeHTML(date)}</div>Date issued</div>
    </div>
  </div>
  <div class="cert-no">Certificate No. ${escapeHTML(opts.certificateNo)}</div>
</div>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 18px;background:#0f172a;color:#fff;border:0;border-radius:6px;cursor:pointer;font-family:inherit">Print / Save as PDF</button>
</div>
</body></html>`;
  const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
