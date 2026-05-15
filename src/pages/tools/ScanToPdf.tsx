import { useEffect, useRef, useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob } from "@/lib/file-utils";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Sun, X } from "lucide-react";

const tool = getTool("scan-to-pdf");

type Scan = { dataUrl: string; w: number; h: number };

export default function ScanToPdf() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [enhance, setEnhance] = useState(true);

  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e: any) {
      throw new Error("Camera access denied. Please allow camera permissions.");
    }
  };
  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const enhanceImage = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const contrast = 1.25;
    const intercept = 128 * (1 - contrast) - 10;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, d[i] * contrast + intercept));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * contrast + intercept));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * contrast + intercept));
    }
    ctx.putImageData(img, 0, 0);
  };

  const capture = () => {
    const v = videoRef.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0);
    if (enhance) enhanceImage(ctx, c.width, c.height);
    setScans((s) => [...s, { dataUrl: c.toDataURL("image/jpeg", 0.92), w: c.width, h: c.height }]);
  };

  const remove = (i: number) => setScans((s) => s.filter((_, idx) => idx !== i));

  const process = async () => {
    if (!scans.length) throw new Error("Capture at least one page first.");
    const pdf = await PDFDocument.create();
    for (const s of scans) {
      const bytes = Uint8Array.from(atob(s.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const img = await pdf.embedJpg(bytes);
      const page = pdf.addPage([s.w, s.h]);
      page.drawImage(img, { x: 0, y: 0, width: s.w, height: s.h });
    }
    downloadBlob(await pdf.save(), "scanned.pdf");
    stop();
  };

  const customBody = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-secondary/30 p-3">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
          <video ref={videoRef} playsInline muted className={`w-full h-full object-contain ${active ? "" : "hidden"}`} />
          {!active && (
            <div className="text-center text-white/70 p-6">
              <Camera className="h-10 w-10 mx-auto mb-2 opacity-70" />
              <p className="text-sm">Tap "Start camera" to begin scanning</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!active ? (
            <Button onClick={async () => { try { await start(); } catch(e: any) { alert(e.message); } }} className="bg-hero-gradient"><Camera className="h-4 w-4 mr-2" /> Start camera</Button>
          ) : (
            <>
              <Button onClick={capture} className="bg-hero-gradient"><Camera className="h-4 w-4 mr-2" /> Capture page</Button>
              <Button variant="outline" onClick={stop}><X className="h-4 w-4 mr-2" /> Stop</Button>
            </>
          )}
          <Button variant="outline" onClick={() => setEnhance((e) => !e)}>
            <Sun className="h-4 w-4 mr-2" /> Enhance: {enhance ? "On" : "Off"}
          </Button>
        </div>
      </div>

      {scans.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">{scans.length} page{scans.length > 1 ? "s" : ""} captured</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {scans.map((s, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                <img src={s.dataUrl} alt={`Scan ${i + 1}`} className="w-full h-24 object-cover" />
                <button
                  onClick={() => remove(i)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-md p-1 opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 rounded">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} customBody={customBody} hideDefaultDropzone ctaLabel="Build PDF & Download" />;
}
