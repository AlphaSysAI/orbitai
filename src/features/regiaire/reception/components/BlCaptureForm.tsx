"use client";

import { useRef, useState } from "react";
import { Camera, FileUp, Loader2 } from "lucide-react";

import { BL_ACCEPT, BL_MAX_BYTES } from "@/features/regiaire/reception/utils/delivery-ui";

export function BlCaptureForm({
  onSubmit,
  isSubmitting,
  error,
}: {
  onSubmit: (file: File) => void;
  isSubmitting?: boolean;
  error?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateAndSubmit = (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    if (file.size > BL_MAX_BYTES) {
      setLocalError("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    onSubmit(file);
  };

  return (
    <div className="space-y-4">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => validateAndSubmit(e.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={BL_ACCEPT}
        className="hidden"
        onChange={(e) => validateAndSubmit(e.target.files?.[0])}
      />

      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => cameraInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-500/50 bg-amber-600/10 py-8 text-amber-400 disabled:opacity-50"
      >
        <Camera size={28} />
        <span className="text-sm font-bold uppercase tracking-wider">
          Photographier le BL
        </span>
      </button>

      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-800 py-4 text-sm font-bold text-slate-200 disabled:opacity-50"
      >
        <FileUp size={20} />
        Importer PDF / image
      </button>

      {(localError || error) && (
        <p className="text-sm text-red-400">{localError ?? error}</p>
      )}

      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 text-sm text-amber-400">
          <Loader2 size={18} className="animate-spin" />
          Analyse IA en cours…
        </div>
      )}

      <p className="text-center text-[10px] text-slate-500">
        PDF, JPEG, PNG ou WebP — 10 Mo max
      </p>
    </div>
  );
}
