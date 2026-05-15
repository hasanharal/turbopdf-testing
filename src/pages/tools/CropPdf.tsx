import { useEffect, useRef, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { pdfjsLib } from "@/lib/pdf-worker";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/Dropzone";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertCircle } from "lucide-react";

const tool = getTool("crop-pdf");

export default function CropPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState({ left: 5, right: 5, top: 5, bottom: 5 });
  const [allPages, setAllPages] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!files[0]) { setPreview(null); return; }
    (async () => {
      const data = new Uint8Array(await files[0].arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 1 });
      setPageSize({ w: vp.width, h: vp.height });
      const renderVp = page.getViewport({ scale: 1.2 });
      const c = document.createElement("canvas");
      c.width = renderVp.width; c.height = renderVp.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: renderVp, canvas: c } as any).promise;
      if (!cancelled) setPreview(c.toDataURL("image/jpeg", 0.8));
    })();
    return () => { cancelled = true; };
  }, [files]);

  const process = async () => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPages();
    for (const p of pages) {
      const { width, height } = p.getSize();
      const lx = (crop.left / 100) * width;
      const rx = (crop.right / 100) * width;
      const ty = (crop.top / 100) * height;
      const by = (crop.bottom / 100) * height;
      const x = lx;
      const y = by;
      const w = width - lx - rx;
      const h = height - ty - by;
      if (w > 10 && h > 10) p.setCropBox(x, y, w, h);
    }
    downloadBlob(await doc.save(), file.name.replace(/\.pdf$/i, "") + "-cropped.pdf");
  };

  const customBody = (
    <div className="space-y-5">
      <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs flex gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Crop hides content using a PDF CropBox but does not permanently delete it.
          To permanently remove content, use a dedicated redaction tool.
        </span>
      </div>
      {preview && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-medium mb-3">Live crop preview (page 1)</p>
          <div className="relative inline-block max-w-full mx-auto">
            <img src={preview} alt="Page preview" className="max-w-full max-h-[500px] block rounded-md border border-border" />
            <div
              className="absolute pointer-events-none border-2 border-primary bg-primary/10 rounded-sm"
              style={{
                left: `${crop.left}%`,
                right: `${crop.right}%`,
                top: `${crop.top}%`,
                bottom: `${crop.bottom}%`,
              }}
            />
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Crop left: {crop.left}%</Label>
          <Slider value={[crop.left]} min={0} max={45} onValueChange={(v) => setCrop({ ...crop, left: v[0] })} />
        </div>
        <div className="space-y-2">
          <Label>Crop right: {crop.right}%</Label>
          <Slider value={[crop.right]} min={0} max={45} onValueChange={(v) => setCrop({ ...crop, right: v[0] })} />
        </div>
        <div className="space-y-2">
          <Label>Crop top: {crop.top}%</Label>
          <Slider value={[crop.top]} min={0} max={45} onValueChange={(v) => setCrop({ ...crop, top: v[0] })} />
        </div>
        <div className="space-y-2">
          <Label>Crop bottom: {crop.bottom}%</Label>
          <Slider value={[crop.bottom]} min={0} max={45} onValueChange={(v) => setCrop({ ...crop, bottom: v[0] })} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={allPages} onCheckedChange={setAllPages} id="ap" />
        <Label htmlFor="ap" className="cursor-pointer">Apply to all pages</Label>
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Crop & Download" />;
}
