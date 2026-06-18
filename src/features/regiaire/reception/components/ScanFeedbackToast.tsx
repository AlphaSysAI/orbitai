"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export type ScanFeedbackKind = "success" | "warning" | "error";

const STYLES: Record<
  ScanFeedbackKind,
  { bg: string; icon: typeof CheckCircle2; label: string }
> = {
  success: {
    bg: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
    icon: CheckCircle2,
    label: "OK",
  },
  warning: {
    bg: "bg-amber-500/20 border-amber-500/50 text-amber-300",
    icon: AlertTriangle,
    label: "Attention",
  },
  error: {
    bg: "bg-red-500/20 border-red-500/50 text-red-300",
    icon: XCircle,
    label: "Erreur",
  },
};

export function ScanFeedbackToast({
  kind,
  message,
}: {
  kind: ScanFeedbackKind;
  message: string;
}) {
  const style = STYLES[kind];
  const Icon = style.icon;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${style.bg}`}
      role="status"
    >
      <Icon size={20} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
