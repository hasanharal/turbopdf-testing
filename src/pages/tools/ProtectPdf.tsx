import { useState } from "react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { getTool } from "@/lib/tools";
import { downloadBlob, validatePdf } from "@/lib/file-utils";
import { PDFDocument as CantooPDFDocument } from "@cantoo/pdf-lib";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

const tool = getTool("protect-pdf");

export default function ProtectPdf() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const process = async (files: File[]) => {
    const file = files[0];
    await validatePdf(file);
    if (password.length < 4) throw new Error("Password must be at least 4 characters.");
    if (password !== confirm) throw new Error("Passwords do not match.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await CantooPDFDocument.load(bytes);
    const data = await (doc as any).save({
      userPassword: password,
      ownerPassword: password,
      permissions: { printing: "highResolution" as const },
    });
    downloadBlob(data, file.name.replace(/\.pdf$/i, "") + "-protected.pdf");
  };

  const options = () => (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs flex gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>Note:</strong> Browser-based PDF encryption has limitations. For highly sensitive documents,
          use professional software like Adobe Acrobat for stronger encryption.
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" />
      </div>
      <div className="space-y-2">
        <Label>Confirm password</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
    </div>
    </div>
  );

  return <ToolPageLayout tool={tool} process={process} options={options} ctaLabel="Encrypt & Download" />;
}
