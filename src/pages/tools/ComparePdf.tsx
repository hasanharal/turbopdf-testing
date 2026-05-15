import { useState } from "react";
import { ToolPageLayout, type ProcessCtx } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { validatePdf, downloadBlob } from "@/lib/file-utils";
import { pdfjsLib } from "@/lib/pdf-worker";
import { Dropzone } from "@/components/Dropzone";
import pixelmatch from "pixelmatch";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const tool = getTool("compare-pdf");

type DiffPage = { idx: number; left: string; right: string; diff: string; changed: number };

export default function ComparePdf() {
  const [a, setA] = useState<File[]>([]);
  const [b, setB] = useState<File[]>([]);

  const renderPage = async (file: File, n: number, scale = 1.2) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const total = pdf.numPages;
    const page = await pdf.getPage(Math.min(n, total));
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c } as any).promise;
    return { canvas: c, ctx, total };
  };

  const process = async (_files: File[], { setProgress, setStatus }: ProcessCtx) => {
    if (!a[0] || !b[0]) throw new Error("Please upload two PDFs to compare.");
    setStatus("Validating PDFs…");
    await validatePdf(a[0]); await validatePdf(b[0]);

    setStatus("Reading documents…");
    const data1 = new Uint8Array(await a[0].arrayBuffer());
    const data2 = new Uint8Array(await b[0].arrayBuffer());
    const p1 = await pdfjsLib.getDocument({ data: data1 }).promise;
    const p2 = await pdfjsLib.getDocument({ data: data2 }).promise;
    const pages = Math.max(p1.numPages, p2.numPages);
    const out: DiffPage[] = [];

    for (let i = 1; i <= pages; i++) {
      setStatus(`Comparing page ${i} of ${pages}…`);
      const left = i <= p1.numPages ? await renderPage(a[0], i) : null;
      const right = i <= p2.numPages ? await renderPage(b[0], i) : null;
      const w = Math.max(left?.canvas.width || 0, right?.canvas.width || 0);
      const h = Math.max(left?.canvas.height || 0, right?.canvas.height || 0);
      if (!w || !h) continue;
      const norm = (src: HTMLCanvasElement | undefined) => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
        if (src) ctx.drawImage(src, 0, 0);
        return { c, ctx };
      };
      const L = norm(left?.canvas);
      const R = norm(right?.canvas);
      const diffC = document.createElement("canvas");
      diffC.width = w; diffC.height = h;
      const diffCtx = diffC.getContext("2d")!;
      const diffData = diffCtx.createImageData(w, h);
      const ld = L.ctx.getImageData(0, 0, w, h).data;
      const rd = R.ctx.getImageData(0, 0, w, h).data;
      const changed = pixelmatch(ld as any, rd as any, diffData.data as any, w, h, { threshold: 0.1, alpha: 0.4 });
      diffCtx.putImageData(diffData, 0, 0);
      out.push({
        idx: i,
        left: L.c.toDataURL("image/jpeg", 0.7),
        right: R.c.toDataURL("image/jpeg", 0.7),
        diff: diffC.toDataURL("image/png"),
        changed: Math.round((changed / (w * h)) * 1000) / 10,
      });
      // Free GPU memory
      L.c.width = 0; L.c.height = 0;
      R.c.width = 0; R.c.height = 0;
      diffC.width = 0; diffC.height = 0;
      setProgress((i / pages) * 100);
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{out.length} page{out.length > 1 ? "s" : ""} compared</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const report = out.map(r => `Page ${r.idx}: ${r.changed}% changed`).join("\n");
              downloadBlob(new Blob([report], { type: "text/plain" }), "comparison-report.txt", "text/plain");
            }}
          >
            <Download className="h-4 w-4 mr-2" /> Download Summary
          </Button>
        </div>
        {out.map((r) => (
          <div key={r.idx} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Page {r.idx}</h4>
              <span className={`text-xs px-2 py-1 rounded-full ${r.changed > 0.1 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                {r.changed}% changed
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Original</p>
                <img src={r.left} className="w-full border border-border rounded-md" alt="A" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Modified</p>
                <img src={r.right} className="w-full border border-border rounded-md" alt="B" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Differences</p>
                <img src={r.diff} className="w-full border border-border rounded-md bg-white" alt="Diff" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const customBody = (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">Original PDF</p>
          <Dropzone accept="application/pdf" files={a} onFiles={setA} cta="Upload original" />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Modified PDF</p>
          <Dropzone accept="application/pdf" files={b} onFiles={setB} cta="Upload modified" />
        </div>
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Compare PDFs" />;
}
