import { useEffect, useRef, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdf-worker";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Eraser } from "lucide-react";

const tool = getTool("sign-pdf");

export default function SignPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [posX, setPosX] = useState(60); // % from left
  const [posY, setPosY] = useState(85); // % from top
  const [sigW, setSigW] = useState(25); // % of page width
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfPageDims, setPdfPageDims] = useState({ w: 595, h: 842 }); // A4 in points
  const previewWrapRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!files[0]) { setPreview(null); setPageCount(1); return; }
    (async () => {
      const data = new Uint8Array(await files[0].arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      setPageCount(pdf.numPages);
      const target = Math.min(Math.max(1, page), pdf.numPages);
      const pg = await pdf.getPage(target);
      const vp = pg.getViewport({ scale: 1.1 });
      // Store actual PDF page dimensions
      const baseVp = pg.getViewport({ scale: 1 });
      if (!cancelled) setPdfPageDims({ w: baseVp.width, h: baseVp.height });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: ctx, viewport: vp, canvas: c } as any).promise;
      if (!cancelled) setPreview(c.toDataURL("image/jpeg", 0.75));
    })();
    return () => { cancelled = true; };
  }, [files, page]);

  const start = (x: number, y: number) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const getPos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setSignature(null);
  };
  const captureSignature = () => {
    setSignature(canvasRef.current!.toDataURL("image/png"));
  };
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setSignature(r.result as string);
    r.readAsDataURL(f);
  };

  const process = async () => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    if (!signature) throw new Error("Please draw or upload your signature.");
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const total = doc.getPageCount();
    const target = Math.min(Math.max(1, page), total) - 1;
    const sigBytes = Uint8Array.from(atob(signature.split(",")[1]), (c) => c.charCodeAt(0));
    const png = await doc.embedPng(sigBytes);
    const p = doc.getPage(target);
    const { width, height } = p.getSize();
    const w = (sigW / 100) * width;
    const h = (png.height / png.width) * w;
    // posX/posY are in % of page (top-left origin). pdf-lib uses bottom-left.
    const cx = (posX / 100) * width;
    const cy = (posY / 100) * height;
    const x = cx - w / 2;
    const y = height - cy - h / 2;
    p.drawImage(png, { x, y, width: w, height: h });
    downloadBlob(await doc.save(), file.name.replace(/\.pdf$/i, "") + "-signed.pdf");
  };

  const customBody = (
    <div className="space-y-5">
      <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />

      <div className="space-y-2">
        <Label>Draw your signature</Label>
        <div className="rounded-xl border border-border bg-secondary/30 p-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            className="w-full bg-background rounded-lg touch-none"
            onPointerDown={(e) => { const p = getPos(e); start(p.x, p.y); }}
            onPointerMove={(e) => { const p = getPos(e); move(p.x, p.y); }}
            onPointerUp={() => { end(); captureSignature(); }}
            onPointerLeave={end}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={clear}><Eraser className="h-3.5 w-3.5 mr-1.5" /> Clear</Button>
          <label className="text-sm cursor-pointer inline-flex items-center px-3 py-1.5 rounded-md border border-border hover:bg-secondary">
            Upload signature image
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onUpload} />
          </label>
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-medium mb-3">Live preview — page {page} of {pageCount}</p>
          <div ref={previewWrapRef} className="relative inline-block max-w-full mx-auto" style={{ maxHeight: 500 }}>
            <img src={preview} alt="Page preview" className="block max-w-full max-h-[500px] rounded-md border border-border bg-white" />
            {signature && (
              <img
                src={signature}
                alt="Signature placement"
                className="absolute pointer-events-none drop-shadow"
                style={{
                  left: `${posX}%`,
                  top: `${posY}%`,
                  width: `${sigW}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Place on page #</Label>
          <Input type="number" min={1} max={pageCount} value={page} onChange={(e) => setPage(Math.max(1, Math.min(pageCount, +e.target.value || 1)))} />
        </div>
        <div className="space-y-2">
          <Label>Signature width: {sigW}%</Label>
          <Slider value={[sigW]} min={10} max={60} step={1} onValueChange={(v) => setSigW(v[0])} />
        </div>
        <div className="space-y-2">
          <Label>Horizontal: {posX}%</Label>
          <Slider value={[posX]} min={0} max={100} step={1} onValueChange={(v) => setPosX(v[0])} />
        </div>
        <div className="space-y-2">
          <Label>Vertical: {posY}%</Label>
          <Slider value={[posY]} min={0} max={100} step={1} onValueChange={(v) => setPosY(v[0])} />
        </div>
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Sign & Download" />;
}
