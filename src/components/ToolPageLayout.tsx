import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, CheckCircle2, AlertCircle, Download, ShieldCheck } from "lucide-react";
import { useState, ReactNode, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Dropzone } from "@/components/Dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Seo } from "@/components/Seo";
import { Tool } from "@/lib/tools";

type State = "idle" | "processing" | "success" | "error";

export type ProcessCtx = {
  setProgress: (n: number) => void;
  setStatus: (s: string) => void;
};

type Props = {
  tool: Tool;
  process: (files: File[], ctx: ProcessCtx) => Promise<ReactNode | void>;
  /** Slot rendered above the action button — for tool-specific options */
  options?: (files: File[]) => ReactNode;
  helper?: ReactNode;
  ctaLabel?: string;
  hideDefaultDropzone?: boolean;
  customBody?: ReactNode;
};

export const ToolPageLayout = ({ tool, process, options, helper, ctaLabel, hideDefaultDropzone, customBody }: Props) => {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<ReactNode>(null);
  const Icon = tool.icon;

  const run = useCallback(async () => {
    if (!files.length && !hideDefaultDropzone) return;
    setState("processing");
    setError("");
    setProgress(0);
    setStatus("Preparing…");
    setResult(null);
    try {
      const r = await process(files, { setProgress, setStatus });
      setProgress(100);
      setStatus("Done");
      if (r) setResult(r);
      setState("success");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Something went wrong. Please try a different file.");
      setState("error");
    }
  }, [files, hideDefaultDropzone, process]);

  const reset = () => {
    setFiles([]);
    setState("idle");
    setError("");
    setProgress(0);
    setStatus("");
    setResult(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title={`${tool.name} — Free Online ${tool.name} Tool | TurboPDF`}
        description={tool.description}
        canonical={`https://turbopdf.app/${tool.slug}`}
      />
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-glow pointer-events-none" />
          <div className="container-tight relative pt-10 pb-6">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ChevronLeft className="h-4 w-4" /> Back to all tools
            </Link>
            <div className="flex items-start gap-4 max-w-3xl">
              <div className={`shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-soft`}>
                <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{tool.name}</h1>
                <p className="mt-2 text-muted-foreground">{tool.description}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="container-tight max-w-3xl">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-7 shadow-soft">
              {!hideDefaultDropzone && (
                <Dropzone accept={tool.accept} multiple={tool.multiple} files={files} onFiles={setFiles} />
              )}

              {customBody}

              {options && (files.length > 0 || hideDefaultDropzone) && state !== "success" && <div className="mt-6">{options(files)}</div>}
              {helper && <div className="mt-5">{helper}</div>}

              {state === "processing" && (
                <div className="mt-6 space-y-2 animate-fade-in">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{status || "Processing…"}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {state === "error" && (
                <div className="mt-5 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 animate-fade-in">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {state === "success" && (
                <div className="mt-5 animate-fade-in space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    <p className="text-sm font-medium text-foreground">Done! Your file has been downloaded.</p>
                  </div>
                  {result}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {state !== "success" ? (
                  <Button
                    size="lg"
                    onClick={run}
                    disabled={(!files.length && !hideDefaultDropzone) || state === "processing"}
                    className="bg-hero-gradient hover:opacity-90 shadow-soft h-12 px-6 font-semibold"
                  >
                    {state === "processing" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    ) : (
                      <><Download className="mr-2 h-4 w-4" /> {ctaLabel || "Process & Download"}</>
                    )}
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" onClick={reset} className="h-12 px-6 font-semibold">
                    Process another file
                  </Button>
                )}
                {files.length > 0 && state === "idle" && (
                  <Button variant="ghost" onClick={reset}>Clear</Button>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2.5 text-xs text-muted-foreground justify-center">
              <ShieldCheck className="h-4 w-4 text-success" />
              Your files never leave your device — secure browser-side processing.
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};
