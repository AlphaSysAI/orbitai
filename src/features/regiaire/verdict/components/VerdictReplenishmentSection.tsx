"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";

import { generateReplenishmentPlan } from "@/features/regiaire/verdict/actions/generate-replenishment-plan";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import type {
  ReplenishmentLine,
  ReplenishmentPlan,
} from "@/features/regiaire/verdict/replenishment/schemas";

type Props = { aireId: string; planDate?: string };

export function VerdictReplenishmentSection({ aireId, planDate }: Props) {
  const [plan, setPlan] = useState<ReplenishmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const result = await generateReplenishmentPlan(aireId, planDate);
      setIsLoading(false);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPlan(result.data);
    })();
  }, [aireId, planDate]);

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Plan de réapprovisionnement
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Horizon 7 jours — top vendeurs + risques de rupture.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 py-10">
          <Loader2 className="animate-spin text-slate-500" size={24} />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-600/5 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {plan && <PlanContent plan={plan} />}
    </section>
  );
}

function PlanContent({ plan }: { plan: ReplenishmentPlan }) {
  const today = todayParisIso();
  const urgentLines = plan.lines.filter(
    (l) => l.orderByDate != null && l.orderByDate <= today && l.suggestedOrderQty > 0
  );

  const byCategory = new Map<string, ReplenishmentLine[]>();
  for (const line of plan.lines) {
    const cat = line.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(line);
  }

  if (plan.lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-8 text-center">
        <CheckCircle2 className="mx-auto text-green-500" size={28} />
        <p className="mt-2 text-sm text-slate-400">
          Aucune commande nécessaire sur 7 jours.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {urgentLines.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-600/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-400" size={16} />
          <p className="text-sm text-red-300">
            <span className="font-bold">
              {urgentLines.length} article{urgentLines.length > 1 ? "s" : ""} à
              commander aujourd&apos;hui
            </span>{" "}
            — délai fournisseur ne laisse plus de marge.
          </p>
        </div>
      )}

      {[...byCategory.entries()].map(([category, lines]) => (
        <CategoryBlock key={category} category={category} lines={lines} today={today} />
      ))}

      <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-[10px] text-slate-500">
        ⚠ v1 — {plan.v1Limitations[0]}
      </p>
    </div>
  );
}

function CategoryBlock({
  category,
  lines,
  today,
}: {
  category: string;
  lines: ReplenishmentLine[];
  today: string;
}) {
  const urgentCount = lines.filter(
    (l) => l.orderByDate != null && l.orderByDate <= today && l.suggestedOrderQty > 0
  ).length;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart size={13} className="text-slate-500" />
        <p className="text-xs font-bold uppercase tracking-wider text-white">
          {category}
        </p>
        {urgentCount > 0 && (
          <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
            {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {lines.map((line) => (
          <ReplenishmentLineRow key={line.product.id} line={line} today={today} />
        ))}
      </ul>
    </div>
  );
}

function ReplenishmentLineRow({
  line,
  today,
}: {
  line: ReplenishmentLine;
  today: string;
}) {
  const isUrgent =
    line.orderByDate != null &&
    line.orderByDate <= today &&
    line.suggestedOrderQty > 0;

  const isSoonish =
    !isUrgent &&
    line.orderByDate != null &&
    line.suggestedOrderQty > 0 &&
    daysBetween(today, line.orderByDate) <= 2;

  const rowBorder = isUrgent
    ? "border-red-500/20 bg-red-600/5"
    : isSoonish
      ? "border-amber-500/20 bg-amber-600/5"
      : "border-slate-800/80 bg-slate-950/60";

  const qtyColor = isUrgent
    ? "text-red-300"
    : isSoonish
      ? "text-amber-300"
      : "text-white";

  return (
    <li
      className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-2.5 ${rowBorder}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {line.product.name}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Stock : {line.currentStock} · Demande 7j :{" "}
          {line.projectedDemand.toFixed(0)}
          {line.supplier ? ` · ${line.supplier.name}` : ""}
        </p>
        {line.reason.length > 0 && (
          <p className="mt-0.5 text-[10px] text-slate-600">
            {line.reason.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-base font-black tabular-nums leading-none ${qtyColor}`}
        >
          ×{line.suggestedOrderQty}
        </span>
        {line.orderByDate ? (
          <span
            className={`text-[10px] font-bold ${isUrgent ? "text-red-400" : isSoonish ? "text-amber-400" : "text-slate-500"}`}
          >
            Cdr avant {formatDate(line.orderByDate)}
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">Date inconnue</span>
        )}
      </div>
    </li>
  );
}

function daysBetween(from: string, to: string): number {
  return (
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
