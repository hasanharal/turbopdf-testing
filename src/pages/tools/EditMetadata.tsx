import { useEffect, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/Dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const tool = getTool("edit-metadata");

export default function EditMetadata() {
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState({ title: "", author: "", subject: "", keywords: "" });

  useEffect(() => {
    if (!files[0]) return;
    (async () => {
      try {
        const bytes = new Uint8Array(await files[0].arrayBuffer());
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const rawKeywords = doc.getKeywords();
        const keywords = Array.isArray(rawKeywords)
          ? rawKeywords.join(", ")
          : typeof rawKeywords === "string"
          ? rawKeywords
          : "";
        setMeta({
          title: doc.getTitle() || "",
          author: doc.getAuthor() || "",
          subject: doc.getSubject() || "",
          keywords,
        });
      } catch {}
    })();
  }, [files]);

  const process = async () => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    doc.setTitle(meta.title);
    doc.setAuthor(meta.author);
    doc.setSubject(meta.subject);
    doc.setKeywords(meta.keywords.split(",").map((k) => k.trim()).filter(Boolean));
    doc.setModificationDate(new Date());
    downloadBlob(await doc.save(), file.name.replace(/\.pdf$/i, "") + "-meta.pdf");
  };

  const customBody = (
    <div className="space-y-5">
      <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>Title</Label>
          <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Author</Label>
          <Input value={meta.author} onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Keywords (comma-separated)</Label>
          <Input value={meta.keywords} onChange={(e) => setMeta({ ...meta, keywords: e.target.value })} />
        </div>
      </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Save Metadata" />;
}
