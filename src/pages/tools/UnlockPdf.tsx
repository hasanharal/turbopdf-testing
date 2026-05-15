import { useEffect, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { pdfjsLib } from "@/lib/pdf-worker";
import { Dropzone } from "@/components/Dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

const tool = getTool("unlock-pdf");

export default function UnlockPdf() {
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!files[0]) { setPreview(null); return; }
    (async () => {
      try {
        const data = new Uint8Array(await files[0].arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1.2 });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas: c } as any).promise;
        if (!cancelled) setPreview(c.toDataURL("image/jpeg", 0.8));
      } catch {
        // Preview generation failed, that's ok
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  const process = async (filesFromCtx: File[]) => {
    // We use the local files state (since hideDefaultDropzone is true)
    const file = files[0] || filesFromCtx[0];
    if (!file) throw new Error("Please upload a PDF.");
    await validatePdf(file);
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Step 1: Verify the password using pdfjs (which actually supports password-based decryption).
    try {
      await pdfjsLib.getDocument({
        data: bytes.slice(),
        password: password || undefined,
      }).promise;
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "PasswordException") {
        throw new Error(password
          ? "Incorrect password. Please double-check and try again."
          : "This PDF is password-protected. Enter the password and try again.");
      }
      throw new Error("Could not open this PDF. It may be corrupted or use unsupported encryption.");
    }

    // Step 2: Re-save with pdf-lib (no encryption). pdf-lib's ignoreEncryption bypasses
    // the encryption check but only works for password-less or already-decrypted streams.
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      throw new Error("This PDF uses encryption that can't be removed in the browser. Try a desktop tool like Adobe Acrobat.");
    }
    try {
      const out = await PDFDocument.create();
      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      const data = await out.save();
      downloadBlob(data, file.name.replace(/\.pdf$/i, "") + "-unlocked.pdf");
    } catch {
      throw new Error("This PDF uses encryption that can't be removed in the browser. Try a desktop tool like Adobe Acrobat.");
    }
  };

  const options = () => (
    <div className="space-y-2">
      <Label>Password (if known)</Label>
      <Input type="password" placeholder="Optional" value={password} onChange={(e) => setPassword(e.target.value)} />
    </div>
  );

  const helper = (
    <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-secondary/60 border border-border">
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <span>Only remove passwords from PDFs you legally own or are authorized to modify.</span>
    </div>
  );

  const customBody = (
    <div className="space-y-5">
      <Dropzone accept="application/pdf" files={files} onFiles={setFiles} />
      {preview && (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-medium mb-3">Preview (page 1)</p>
          <img src={preview} alt="Page preview" className="max-w-full max-h-[400px] rounded-md border border-border" />
        </div>
      )}
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} options={options} helper={helper} customBody={customBody} hideDefaultDropzone />;
}
