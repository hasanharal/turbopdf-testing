import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const tool = getTool("excel-to-pdf");

export default function ExcelToPdf() {
  const process = async (files: File[], { setStatus }: any) => {
    const file = files[0];
    if (!file) throw new Error("Please upload an Excel file.");
    setStatus("Reading workbook…");
    const data = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(data, { type: "array" });

    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const margin = 32;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    let firstSheet = true;
    for (const name of wb.SheetNames) {
      setStatus(`Rendering sheet: ${name}`);
      const sheet = wb.Sheets[name];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
      if (!rows.length) continue;
      if (!firstSheet) pdf.addPage();
      firstSheet = false;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(name, margin, margin + 4);

      const cols = Math.max(...rows.map((r) => r.length));
      
      // Calculate column widths based on content
      const colWidths = Array.from({ length: cols }, (_, c) => {
        const maxLen = Math.max(...rows.map((r) => String(r[c] ?? "").length), 3);
        return Math.max(40, Math.min(maxLen * 6, 150)); // min 40pt, max 150pt per column
      });
      const totalW = colWidths.reduce((a, b) => a + b, 0);
      const scale = Math.min(1, (pageW - margin * 2) / totalW);
      const scaledWidths = colWidths.map((w) => w * scale);
      
      const rowH = 18;
      let y = margin + 22;

      pdf.setFontSize(Math.max(7, 9 * scale));
      for (let r = 0; r < rows.length; r++) {
        if (y + rowH > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        const row = rows[r];
        pdf.setFont("helvetica", r === 0 ? "bold" : "normal");
        if (r === 0) {
          pdf.setFillColor(242, 244, 250);
          const totalScaledW = scaledWidths.reduce((a, b) => a + b, 0);
          pdf.rect(margin, y - rowH + 4, totalScaledW, rowH, "F");
        }
        let x = margin;
        for (let c = 0; c < cols; c++) {
          const colW = scaledWidths[c];
          pdf.setDrawColor(220);
          pdf.rect(x, y - rowH + 4, colW, rowH);
          const txt = String(row[c] ?? "");
          const lines = pdf.splitTextToSize(txt, colW - 6);
          // Show first line with ellipsis if truncated
          let displayText = lines[0] || "";
          if (lines.length > 1) displayText = displayText.slice(0, -2) + "...";
          pdf.text(displayText, x + 3, y - 2);
          x += colW;
        }
        y += rowH;
      }
    }

    const blob = pdf.output("blob");
    downloadBlob(blob, file.name.replace(/\.(xlsx?|xls)$/i, "") + ".pdf");
  };

  return <ToolPageLayout tool={tool} process={process} ctaLabel="Convert to PDF" />;
}
