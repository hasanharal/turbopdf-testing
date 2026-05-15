import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, formatBytes } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";

const tool = getTool("repair-pdf");

export default function RepairPdf() {
  const process = async (files: File[], { setStatus }: any) => {
    const file = files[0];
    if (!file) throw new Error("Please upload a PDF.");
    setStatus("Checking file health...");
    const bytes = new Uint8Array(await file.arrayBuffer());
    
    // Pre-flight check: determine if the PDF is actually damaged
    let isHealthy = true;
    let src: PDFDocument;
    try {
      src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
      // Try to access all pages to verify integrity
      for (const i of src.getPageIndices()) {
        src.getPage(i);
      }
    } catch {
      isHealthy = false;
    }
    
    if (isHealthy && src!) {
      // PDF appears healthy - verify by trying a full copy
      try {
        const testOut = await PDFDocument.create();
        const indices = src.getPageIndices();
        for (const i of indices) {
          const [p] = await testOut.copyPages(src, [i]);
          testOut.addPage(p);
        }
        // PDF is fully readable
        return (
          <div className="text-sm text-muted-foreground">
            This PDF appears to be <strong className="text-success">healthy</strong>. No repair was necessary. The file has {indices.length} page{indices.length > 1 ? "s" : ""} and opens without errors.
          </div>
        );
      } catch {
        // Fall through to repair
      }
    }

    setStatus("Loading damaged file...");
    try {
      src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    } catch (e: any) {
      throw new Error("This PDF is too damaged to be repaired in the browser. Try opening it in Adobe Reader and re-saving.");
    }
    
    setStatus("Rebuilding PDF structure...");
    const out = await PDFDocument.create();
    const indices = src.getPageIndices();
    let recovered = 0;
    for (const i of indices) {
      try {
        const [p] = await out.copyPages(src, [i]);
        out.addPage(p);
        recovered++;
      } catch {}
    }
    if (!recovered) throw new Error("Couldn't recover any readable pages from this file.");
    out.setProducer("TurboPDF Repair");
    out.setModificationDate(new Date());
    const data = await out.save({ useObjectStreams: true });
    downloadBlob(data, file.name.replace(/\.pdf$/i, "") + "-repaired.pdf");
    return (
      <div className="text-sm text-muted-foreground">
        Recovered <strong className="text-foreground">{recovered}</strong> page{recovered > 1 ? "s" : ""} from the damaged file. New file size: <strong className="text-foreground">{formatBytes(data.byteLength)}</strong>.
      </div>
    );
  };

  return <ToolPageLayout tool={tool} process={process} ctaLabel="Repair PDF" />;
}
