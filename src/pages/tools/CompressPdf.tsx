import { useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, formatBytes, validatePdf } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdf-worker";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle } from "lucide-react";

const tool = getTool("compress-pdf");

type Level = "low" | "medium" | "high";

const LEVELS: Record<Level, { dpi: number; quality: number; label: string; sub: string }> = {
  low: { dpi: 150, quality: 0.85, label: "Low compression", sub: "Best quality · slightly smaller" },
  medium: { dpi: 110, quality: 0.7, label: "Recommended", sub: "Balanced quality and size" },
  high: { dpi: 80, quality: 0.55, label: "High compression", sub: "Smallest file · lower quality" },
};

export default function CompressPdf() {
  const [level, setLevel] = useState<Level>("medium");

  const process = async (files: File[], { setProgress, setStatus }: any) => {
    const file = files[0];
    await validatePdf(file);
    const original = file.size;
    const settings = LEVELS[level];

    setStatus("Reading PDF…");
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: data.slice() }).promise;
    const total = pdf.numPages;

    const out = await PDFDocument.create();

    for (let i = 1; i <= total; i++) {
      setStatus(`Compressing page ${i} of ${total}…`);
      const page = await pdf.getPage(i);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = settings.dpi / 72;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false })!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b!), "image/jpeg", settings.quality)!
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const jpg = await out.embedJpg(bytes);
      const newPage = out.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(jpg, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });

      // Free memory
      canvas.width = canvas.height = 0;
      setProgress((i / total) * 95);
    }

    setStatus("Saving…");
    const compressed = await out.save({ useObjectStreams: true });
    const finalSize = compressed.byteLength;
    const reduction = Math.max(0, ((original - finalSize) / original) * 100);

    const name = file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
    downloadBlob(compressed, name);

    return (
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Original" value={formatBytes(original)} />
        <Stat label="Compressed" value={formatBytes(finalSize)} />
        <Stat label="Reduction" value={`${reduction.toFixed(1)}%`} accent />
      </div>
    );
  };

  const options = () => (
    <div>
      <div className="mb-4 p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs flex gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>Important:</strong> This tool rasterizes pages to images. Text in the output PDF will NOT be
          selectable, copyable, or searchable. If you need text-preserving compression, use a desktop tool.
        </span>
      </div>
      <Label className="text-sm font-semibold mb-3 block">Compression level</Label>
      <RadioGroup value={level} onValueChange={(v) => setLevel(v as Level)} className="grid sm:grid-cols-3 gap-3">
        {(Object.keys(LEVELS) as Level[]).map((k) => (
          <label
            key={k}
            htmlFor={`level-${k}`}
            className={`relative flex flex-col gap-1 p-4 rounded-xl border cursor-pointer transition-all ${
              level === k ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"
            }`}
          >
            <RadioGroupItem id={`level-${k}`} value={k} className="sr-only" />
            <span className="text-sm font-semibold capitalize">{k}</span>
            <span className="text-xs text-muted-foreground">{LEVELS[k].sub}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} options={options} />;
}

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-xl border border-border bg-secondary/40 p-4">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`mt-1 text-lg font-bold ${accent ? "text-gradient" : ""}`}>{value}</div>
  </div>
);
