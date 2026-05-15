import { useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const tool = getTool("page-numbers");

export default function PageNumbers() {
  const [position, setPosition] = useState("bottom-center");
  const [format, setFormat] = useState("page-of");
  const [start, setStart] = useState(1);

  const process = async (files: File[]) => {
    const file = files[0];
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const total = doc.getPageCount();

    doc.getPages().forEach((page, i) => {
      const n = i + start;
      const displayTotal = total + start - 1;
      const text = format === "n-only" ? `${n}` : format === "page-n" ? `Page ${n}` : `${n} / ${displayTotal}`;
      const size = 11;
      const { width, height } = page.getSize();
      const tw = font.widthOfTextAtSize(text, size);
      const margin = 24;
      let x = width / 2 - tw / 2;
      let y = margin;
      if (position.startsWith("top")) y = height - margin;
      if (position.endsWith("left")) x = margin;
      if (position.endsWith("right")) x = width - tw - margin;
      page.drawText(text, { x, y, size, font, color: rgb(0.3, 0.3, 0.3) });
    });

    const data = await doc.save();
    downloadBlob(data, file.name.replace(/\.pdf$/i, "") + "-numbered.pdf");
  };

  const options = () => (
    <div className="grid sm:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label>Position</Label>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["top-left","top-center","top-right","bottom-left","bottom-center","bottom-right"].map(p =>
              <SelectItem key={p} value={p}>{p.replace("-", " ")}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Format</Label>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="page-of">1 / N</SelectItem>
            <SelectItem value="page-n">Page N</SelectItem>
            <SelectItem value="n-only">N</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Start at</Label>
        <Input type="number" min={1} value={start} onChange={(e) => setStart(Math.max(1, +e.target.value || 1))} />
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} options={options} />;
}
