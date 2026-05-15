import { useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

const tool = getTool("html-to-pdf");

export default function HtmlToPdf() {
  const [tab, setTab] = useState<"html" | "url">("html");
  const [html, setHtml] = useState("<h1>Hello TurboPDF</h1>\n<p>Paste any HTML here and it will be converted into a clean PDF.</p>");
  const [url, setUrl] = useState("");

  const renderHtmlToPdf = async (sourceHtml: string, baseHref?: string) => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.top = "-10000px";
    wrapper.style.left = "0";
    wrapper.style.width = "794px"; // A4 width @ 96dpi
    wrapper.style.padding = "32px";
    wrapper.style.background = "#fff";
    wrapper.style.color = "#0f172a";
    wrapper.style.fontFamily = "Inter, system-ui, sans-serif";
    if (baseHref) {
      wrapper.innerHTML = `<base href="${baseHref}">` + sourceHtml;
    } else {
      wrapper.innerHTML = sourceHtml;
    }
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
        console.warn("[HtmlToPdf] Document is very long; some content may render imperfectly.");
      }
      return pdf.output("blob");
    } finally {
      wrapper.remove();
    }
  };

  const process = async (_: File[], { setStatus }: any) => {
    if (tab === "html") {
      if (!html.trim()) throw new Error("Please enter some HTML.");
      setStatus("Rendering HTML…");
      const blob = await renderHtmlToPdf(html);
      downloadBlob(blob, "page.pdf");
    } else {
      if (!url.trim()) throw new Error("Please enter a URL.");
      setStatus("Fetching webpage…");
      let html: string;
      try {
        const res = await fetch(url);
        html = await res.text();
      } catch {
        throw new Error("Could not fetch this URL. The page may block cross-origin requests. Try pasting its HTML instead.");
      }
      setStatus("Rendering page…");
      const blob = await renderHtmlToPdf(html, url);
      downloadBlob(blob, "webpage.pdf");
    }
  };

  const customBody = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="html">Paste HTML</TabsTrigger>
        <TabsTrigger value="url">From URL</TabsTrigger>
      </TabsList>
      <TabsContent value="html" className="space-y-2 mt-4">
        <Label>HTML content</Label>
        <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={10} className="font-mono text-xs" />
      </TabsContent>
      <TabsContent value="url" className="space-y-2 mt-4">
        <Label>Page URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" type="url" />
        <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 mt-2 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            ⚠️ URL mode only works for simple, public, CORS-friendly pages. Most modern websites will fail.
            Use "Paste HTML" tab for reliable conversion.
          </span>
        </div>
      </TabsContent>
    </Tabs>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Convert to PDF" />;
}
