import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import mammoth from "mammoth";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const tool = getTool("word-to-pdf")!;

export default function WordToPdf() {
  const renderHtmlToPdf = async (sourceHtml: string) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.top = "-10000px";
    wrapper.style.left = "0";
    wrapper.style.width = "794px"; // A4 width @ 96dpi
    wrapper.style.padding = "32px";
    wrapper.style.background = "#fff";
    wrapper.style.color = "#0f172a";
    wrapper.style.fontFamily = "Calibri, Inter, system-ui, sans-serif";
    wrapper.innerHTML = sourceHtml;
    document.body.appendChild(wrapper);
    try {
      const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.92);
      // Correct multi-page slicing: shift the image up by one page-height per page.
      const totalPages = Math.max(1, Math.ceil(imgH / pageH));
      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, -(pageIdx * pageH), imgW, imgH);
      }
      if (canvas.height > 16000) {
        console.warn("[WordToPdf] Document is very long; some content may render imperfectly.");
      }
      return pdf.output("blob");
    } finally {
      wrapper.remove();
    }
  };

  const process = async (files: File[]) => {
    const file = files[0];
    const arrayBuffer = await file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    const blob = await renderHtmlToPdf(html || "<p>No content found</p>");
    downloadBlob(blob, file.name.replace(/\.docx?$/i, "") + ".pdf");
  };

  const helper = (
    <p className="text-xs text-muted-foreground">
      Converts Word documents to PDF preserving basic formatting (headings, bold, italic, lists). Complex layouts and images may not be pixel-perfect.
    </p>
  );

  return <ToolPageLayout tool={tool} process={process} helper={helper} />;
}
