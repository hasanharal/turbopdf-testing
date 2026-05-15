import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ZoomIn, ZoomOut, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { getTool } from "@/lib/tools";
import { pdfjsLib } from "@/lib/pdf-worker";
import { validatePdf } from "@/lib/file-utils";

const tool = getTool("pdf-reader");

export default function PdfReader() {
  const [files, setFiles] = useState<File[]>([]);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const file = files[0]; if (!file) { setPdf(null); return; }
    (async () => {
      try {
        await validatePdf(file);
        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data }).promise;
        setPdf(doc); setPageNum(1); setError("");
      } catch (e: any) { setError(e?.message || "Could not open file"); }
    })();
  }, [files]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    (async () => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const c = canvasRef.current!;
      c.width = viewport.width; c.height = viewport.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport, canvas: c } as any).promise;
    })();
  }, [pdf, pageNum, scale]);

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title={`${tool.name} — Free Online PDF Reader | TurboPDF`} description={tool.description} canonical={`https://turbopdf.app/${tool.slug}`} />
      <Navbar />
      <main className="flex-1">
        <section className="container-tight pt-10 pb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ChevronLeft className="h-4 w-4" /> Back to all tools
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{tool.name}</h1>
          <p className="mt-2 text-muted-foreground">{tool.description}</p>
        </section>

        <section className="container-tight pb-16">
          {!pdf ? (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-soft">
              <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                  <input
                    type="number"
                    min={1}
                    max={pdf.numPages}
                    value={pageNum}
                    onChange={(e) => setPageNum(Math.max(1, Math.min(pdf.numPages, +e.target.value || 1)))}
                    className="w-14 text-center border rounded px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">/ {pdf.numPages}</span>
                  <Button variant="outline" size="icon" onClick={() => setPageNum((n) => Math.min(pdf.numPages, n + 1))} disabled={pageNum >= pdf.numPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                  <span className="text-sm tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
                  <Button variant="outline" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { setFiles([]); setPdf(null); }}>Close</Button>
                </div>
              </div>
              <div className="overflow-auto rounded-xl bg-secondary/40 p-4 max-h-[70vh] flex justify-center">
                <canvas ref={canvasRef} className="shadow-soft rounded" />
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
