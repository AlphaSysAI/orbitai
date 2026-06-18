"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";

export function ManualEanInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (ean: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed.replace(/\D/g, ""));
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <Keyboard size={14} />
        Saisie manuelle EAN
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex. 3017620422003"
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-xl bg-slate-800 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          Valider
        </button>
      </div>
    </form>
  );
}
