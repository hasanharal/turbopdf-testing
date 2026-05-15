import { useEffect, useRef, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdf-worker";
import { Dropzone } from "@/components/Dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tool = getTool("watermark-pdf");

export default function WatermarkPdf() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("CONFIDENTIAL");
  const [opacity, setOpacity] = useState(30);
  const [position, setPosition] = useState("center");
  const [size, setSize] = useState(60);
  const [preview, setPreview] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState({ w: 595, h: 842 }); // A4 in points
  const previewImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!files[0]) { setPreview(null); return; }
    (async () => {
      const data = new Uint8Array(await files[0].arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 1.1 });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas: c } as any).promise;
      if (!cancelled) {
        setPreview(c.toDataURL("image/jpeg", 0.75));
        setPageDims({ w: vp.width, h: vp.height });
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  const process = async () => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    await validatePdf(file);
    if (!text.trim()) throw new Error("Watermark text cannot be empty.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const tw = font.widthOfTextAtSize(text, size);
      let x = (width - tw) / 2;
      let y = height / 2;
      let rot = 0;
      if (position === "diagonal") { rot = 45; x = width / 4; y = height / 4; }
      else if (position === "top") { y = height - size - 24; }
      else if (position === "bottom") { y = 24; }
      page.drawText(text, {
        x, y, size, font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: opacity / 100,
        rotate: degrees(rot),
      });
    }
    const data = await doc.save();
    downloadBlob(data, file.name.replace(/\.pdf$/i, "") + "-watermarked.pdf");
  };

  // Preview overlay: derive scaled position with accurate sizing
  const previewOverlay = () => {
    if (!preview) return null;
    // Calculate the scaling factor between preview image and actual PDF
    const previewImgW = previewImgRef.current?.offsetWidth || pageDims.w;
    const pxPerPt = previewImgW / pageDims.w;
    const scaledFontSize = size * pxPerPt;
    let style: React.CSSProperties = {
      position: "absolute",
      color: "rgba(80, 80, 80, 1)",
      opacity: opacity / 100,
      fontSize: `${scaledFontSize}px`,
      fontFamily: "Arial Black, Helvetica, sans-serif",
      fontWeight: 800,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      userSelect: "none",
    };
    if (position === "center") {
      style = { ...style, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    } else if (position === "diagonal") {
      style = { ...style, left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(-45deg)" };
    } else if (position === "top") {
      style = { ...style, left: "50%", top: "6%", transform: "translateX(-50%)" };
    } else {
      style = { ...style, left: "50%", bottom: "6%", transform: "translateX(-50%)" };
    }
    return <span style={style}>{text || " "}</span>;
  };

  const customBody = (
    <div className="space-y-5">
      <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />
      {preview && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-medium mb-3">Live preview (page 1)</p>
          <div className="relative inline-block max-w-full mx-auto" style={{ maxHeight: 500 }}>
            <img ref={previewImgRef} src={preview} alt="Preview" className="block max-w-full max-h-[500px] rounded-md border border-border bg-white" />
            <div className="absolute inset-0 overflow-hidden rounded-md">{previewOverlay()}</div>
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>Watermark text</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label>Position</Label>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="diagonal">Diagonal</SelectItem>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Font size: {size}pt</Label>
          <Slider value={[size]} min={20} max={140} step={2} onValueChange={(v) => setSize(v[0])} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Opacity: {opacity}%</Label>
          <Slider value={[opacity]} min={10} max={100} step={5} onValueChange={(v) => setOpacity(v[0])} />
        </div>
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone />;
}
