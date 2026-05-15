import { useState } from "react";
import { ToolPageLayout, type ProcessCtx } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, parsePageRanges, validatePdf } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const tool = getTool("split-pdf")!;

export default function SplitPdf() {
  const [mode, setMode] = useState<"ranges" | "all">("ranges");
  const [ranges, setRanges] = useState("1-3, 4-6");

  const process = async (files: File[], { setProgress, setStatus }: ProcessCtx) => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const total = src.getPageCount();
    const baseName = file.name.replace(/\.pdf$/i, "");

    if (mode === "all") {
      for (let i = 0; i < total; i++) {
        setStatus(`Exporting page ${i + 1} of ${total}…`);
        const out = await PDFDocument.create();
        const [page] = await out.copyPages(src, [i]);
        out.addPage(page);
        const data = await out.save();
        downloadBlob(data, `${baseName}-page-${i + 1}.pdf`);
        await new Promise((r) => setTimeout(r, 250));
        setProgress(((i + 1) / total) * 100);
      }
      return;
    }

    // Range mode
    const parts = ranges.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) throw new Error("Enter at least one page range.");
    for (let idx = 0; idx < parts.length; idx++) {
      setStatus(`Exporting range ${idx + 1} of ${parts.length}…`);
      const pages = parsePageRanges(parts[idx], total);
      if (!pages.length) continue;
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p - 1));
      copied.forEach((p) => out.addPage(p));
      const data = await out.save();
      const rangeLabel = parts[idx].replace(/\s/g, "");
      downloadBlob(data, `${baseName}-pages-${rangeLabel}.pdf`);
      await new Promise((r) => setTimeout(r, 300));
      setProgress(((idx + 1) / parts.length) * 100);
    }
  };

  const options = () => (
    <div className="space-y-4">
      <RadioGroup value={mode} onValueChange={(v) => setMode(v as "ranges" | "all")} className="grid sm:grid-cols-2 gap-3">
        <Label htmlFor="m-ranges" className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/60 transition">
          <RadioGroupItem value="ranges" id="m-ranges" className="mt-0.5" />
          <div>
            <div className="font-medium text-sm">Custom page ranges</div>
            <p className="text-xs text-muted-foreground mt-0.5">Split into one PDF per range you specify.</p>
          </div>
        </Label>
        <Label htmlFor="m-all" className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:border-primary/60 transition">
          <RadioGroupItem value="all" id="m-all" className="mt-0.5" />
          <div>
            <div className="font-medium text-sm">Every page</div>
            <p className="text-xs text-muted-foreground mt-0.5">Export each page as its own PDF.</p>
          </div>
        </Label>
      </RadioGroup>
      {mode === "ranges" && (
        <div className="space-y-2">
          <Label htmlFor="ranges-input">Page ranges (comma-separated)</Label>
          <Input id="ranges-input" value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="e.g. 1-3, 4-6, 7" />
          <p className="text-xs text-muted-foreground">Each range downloads as a separate PDF. Your browser may prompt to allow multiple downloads.</p>
        </div>
      )}
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} options={options} ctaLabel="Split & Download" />;
}
