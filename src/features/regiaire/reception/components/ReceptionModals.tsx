"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import type { ProductLookup } from "@/features/regiaire/reception/schemas";

export function UnknownEanKnownProductModal({
  ean,
  product,
  onConfirm,
  onCancel,
  isLoading,
}: {
  ean: string;
  product: ProductLookup;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <ModalShell title="Produit connu">
      <p className="text-sm text-slate-300">
        EAN <span className="font-mono text-amber-400">{ean}</span> absent du BL.
      </p>
      <p className="mt-2 text-sm text-white">
        Produit connu : <strong>{product.name}</strong>
      </p>
      <p className="mt-1 text-xs text-slate-500">L&apos;ajouter en non-attendu ?</p>
      <ModalActions
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Ajouter"
        isLoading={isLoading}
      />
    </ModalShell>
  );
}

export function UnknownEanNewProductModal({
  ean,
  onConfirm,
  onCancel,
  isLoading,
}: {
  ean: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <ModalShell title="Nouveau produit">
      <p className="text-sm text-slate-300">
        EAN <span className="font-mono text-amber-400">{ean}</span> inconnu du catalogue.
      </p>
      <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Nom du produit
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-500"
        placeholder="Ex. Chips paprika 150g"
        autoFocus
      />
      <ModalActions
        onCancel={onCancel}
        onConfirm={() => onConfirm(name.trim())}
        confirmLabel="Créer et ajouter"
        isLoading={isLoading}
        disabled={!name.trim()}
      />
    </ModalShell>
  );
}

export function InstanceLinePickModal({
  ean,
  lines,
  onPickLine,
  onPickUnexpected,
  onCancel,
  isLoading,
}: {
  ean: string;
  lines: Array<{ id: string; raw_name: string }>;
  onPickLine: (lineId: string) => void;
  onPickUnexpected: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <ModalShell title="Associer l'EAN scanné">
      <p className="text-sm text-slate-300">
        EAN <span className="font-mono text-amber-400">{ean}</span> absent des lignes
        résolues.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        C&apos;est lequel des produits en instance ?
      </p>
      <ul className="mt-4 space-y-2">
        {lines.map((line) => (
          <li key={line.id}>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onPickLine(line.id)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm font-medium text-white hover:border-amber-500/50 disabled:opacity-50"
            >
              {line.raw_name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={isLoading}
        onClick={onPickUnexpected}
        className="mt-3 w-full rounded-xl border border-dashed border-orange-500/50 py-3 text-sm font-bold text-orange-400 disabled:opacity-50"
      >
        Nouveau produit non-attendu
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={onCancel}
        className="mt-2 w-full py-2 text-xs font-bold uppercase text-slate-500"
      >
        Annuler
      </button>
    </ModalShell>
  );
}

export function DlcPromptModal({
  productName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  productName: string;
  onConfirm: (dlc: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [dlc, setDlc] = useState("");

  return (
    <ModalShell title="Date DLC requise">
      <p className="text-sm text-slate-300">
        Saisissez la DLC pour <strong className="text-white">{productName}</strong>.
      </p>
      <input
        type="date"
        value={dlc}
        onChange={(e) => setDlc(e.target.value)}
        className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-500"
      />
      <ModalActions
        onCancel={onCancel}
        onConfirm={() => dlc && onConfirm(dlc)}
        confirmLabel="Enregistrer"
        isLoading={isLoading}
        disabled={!dlc}
      />
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  isLoading,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isLoading}
        className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-bold text-slate-300"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading || disabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {isLoading && <Loader2 size={16} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}
