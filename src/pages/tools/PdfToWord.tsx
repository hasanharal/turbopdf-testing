import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite asset import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const tool = getTool("pdf-to-word")!;

// Build a minimal valid .docx (Word) file containing the extracted plain text with formatting.
const buildDocx = async (text: string): Promise<Uint8Array> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels")!.file(".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  // Add word/_rels/document.xml.rels for a valid .docx structure
  zip.folder("word")!.folder("_rels")!.file("document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
  const escape = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const paragraphs = text.split(/\n+/).map(line =>
    `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escape(line)}</w:t></w:r></w:p>`
  ).join("");
  zip.folder("word")!.file("document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}</w:body>
</w:document>`);
  return await zip.generateAsync({ type: "uint8array" });
};

export default function PdfToWord() {
  const process = async (files: File[]) => {
    const file = files[0];
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const text = tc.items.map((it: any) => it.str).join(" ");
      fullText += text + "\n\n";
    }
    let bytes: Uint8Array;
    try {
      bytes = await buildDocx(fullText);
    } catch {
      // Fallback: download as .doc (HTML inside .doc works in Word)
      const html = `<html><body><pre>${fullText.replace(/[<>]/g, "")}</pre></body></html>`;
      const blob = new Blob([html], { type: "application/msword" });
      downloadBlob(blob, file.name.replace(/\.pdf$/i, "") + ".doc", "application/msword");
      return;
    }
    downloadBlob(
      bytes,
      file.name.replace(/\.pdf$/i, "") + ".docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  };

  const helper = (
    <p className="text-xs text-muted-foreground">
      Extracts editable text from your PDF. Note: complex layouts and scanned (image-only) PDFs aren't supported.
    </p>
  );

  return <ToolPageLayout tool={tool} process={process} helper={helper} />;
}
