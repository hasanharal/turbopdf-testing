import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import jsPDF from "jspdf";
import JSZip from "jszip";

const tool = getTool("powerpoint-to-pdf");

const extractText = (xml: string): string[] => {
  const out: string[] = [];
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
};

export default function PowerpointToPdf() {
  const process = async (files: File[], { setProgress, setStatus }: any) => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PowerPoint file.");
    if (!/\.pptx$/i.test(file.name)) {
      throw new Error("Only .pptx files are supported in the browser. Please save as .pptx and retry.");
    }
    setStatus("Reading slides…");
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = +a.match(/slide(\d+)\.xml/)![1];
        const nb = +b.match(/slide(\d+)\.xml/)![1];
        return na - nb;
      });
    if (!slides.length) throw new Error("No slides found inside the file.");

    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540] });
    const W = 960, H = 540, margin = 50;

    for (let i = 0; i < slides.length; i++) {
      setStatus(`Rendering slide ${i + 1} of ${slides.length}…`);
      const xml = await zip.file(slides[i])!.async("string");
      const lines = extractText(xml);
      if (i > 0) pdf.addPage();

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, W, H, "F");
      pdf.setDrawColor(230);
      pdf.setLineWidth(1);
      pdf.rect(20, 20, W - 40, H - 40);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(140);
      pdf.text(`Slide ${i + 1}`, margin, margin - 8);

      let y = margin + 20;
      let isFirst = true;
      for (const line of lines) {
        if (y > H - margin) break;
        pdf.setTextColor(20);
        if (isFirst) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(28);
          const wrapped = pdf.splitTextToSize(line, W - margin * 2);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 32 + 8;
          isFirst = false;
        } else {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(14);
          const wrapped = pdf.splitTextToSize("• " + line, W - margin * 2);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 18 + 4;
        }
      }
      setProgress(((i + 1) / slides.length) * 95);
    }

    downloadBlob(pdf.output("blob"), file.name.replace(/\.pptx$/i, "") + ".pdf");
  };

  return (
    <ToolPageLayout
      tool={tool}
      process={process}
      ctaLabel="Convert to PDF"
      helper={
        <p className="text-xs text-muted-foreground">
          Extracts text content from each slide into a clean PDF page. Images, visual layouts, charts, and animations are not preserved.
          For full fidelity with images and design, export to PDF directly from PowerPoint.
        </p>
      }
    />
  );
}
