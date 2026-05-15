import { useDropzone } from "react-dropzone";
import { Upload, X, FileIcon } from "lucide-react";
import { useState, useCallback } from "react";
import { formatBytes } from "@/lib/file-utils";
import { Button } from "@/components/ui/button";

type Props = {
  accept: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  cta?: string;
};

export const Dropzone = ({ accept, multiple = false, files, onFiles, cta = "Drop files or click to upload" }: Props) => {
  const [isDragActive2, setActive] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => {
      onFiles(multiple ? [...files, ...accepted] : accepted.slice(0, 1));
    },
    [files, multiple, onFiles]
  );

  const acceptObj = accept.split(",").reduce((acc, token) => {
    const t = token.trim();
    if (t.startsWith(".")) {
      // File extension — needs to be mapped to a generic MIME type key
      acc["application/octet-stream"] = [...(acc["application/octet-stream"] || []), t];
    } else {
      acc[t] = [];
    }
    return acc;
  }, {} as Record<string, string[]>);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptObj,
    multiple,
    onDragEnter: () => setActive(true),
    onDragLeave: () => setActive(false),
  });

  const removeFile = (i: number) => onFiles(files.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 ${
          isDragActive || isDragActive2
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/60 hover:bg-secondary/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-hero-gradient blur-2xl opacity-30 animate-pulse-glow" />
            <div className="relative h-16 w-16 rounded-2xl bg-hero-gradient flex items-center justify-center shadow-glow-primary">
              <Upload className="h-7 w-7 text-white" strokeWidth={2.2} />
            </div>
          </div>
          <div>
            <p className="text-base sm:text-lg font-semibold">{cta}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {multiple ? "You can select multiple files" : "Maximum 1 file"} · processed locally in your browser
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2 animate-fade-in">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeFile(i)} aria-label="Remove file">
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
