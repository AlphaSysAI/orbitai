"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fuel, Loader2, MapPin } from "lucide-react";

import { listAiresForOrg } from "@/features/regiaire/aires/actions";
import type { AireListItem } from "@/features/regiaire/aires/schemas";
import { extractAireIdFromPath } from "@/lib/organizations/navigation";

export function MesAiresFlyoutNav() {
  const pathname = usePathname();
  const currentAireId = extractAireIdFromPath(pathname);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [aires, setAires] = useState<AireListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({ top: rect.top, left: rect.right + 10 });
  }, []);

  const loadAires = useCallback(async () => {
    setIsLoading(true);
    const result = await listAiresForOrg();
    if (result.success) {
      setAires(result.data);
    }
    setHasLoaded(true);
    setIsLoading(false);
  }, []);

  const openFlyout = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
    if (!hasLoaded) {
      void loadAires();
    }
  };

  const scheduleClose = () => {
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const isHubActive =
    pathname === "/station" ||
    (Boolean(currentAireId) && pathname.startsWith("/station/"));

  return (
    <div
      ref={anchorRef}
      onMouseEnter={() => {
        cancelClose();
        openFlyout();
      }}
      onMouseLeave={scheduleClose}
    >
      <Link
        href="/station"
        className={`flex w-full items-center gap-3 rounded-xl p-2.5 transition-all ${
          isHubActive
            ? "border border-amber-500/40 bg-amber-600/20 text-amber-400"
            : "border border-transparent bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        <Fuel size={18} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Mes aires
        </span>
      </Link>

      {isOpen && (
        <div
          className="fixed z-[200]"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="rounded-2xl border border-slate-700/80 bg-[#0f172a] p-3 shadow-2xl shadow-black/50 ring-1 ring-amber-500/10">
            <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
              Vos aires
            </p>

            {isLoading && !hasLoaded ? (
              <div className="flex h-24 w-48 items-center justify-center">
                <Loader2 className="animate-spin text-amber-400" size={20} />
              </div>
            ) : aires.length === 0 ? (
              <p className="max-w-xs px-1 py-4 text-xs text-slate-500">
                Aucune aire configurée. Contactez votre administrateur OrbitAI.
              </p>
            ) : (
              <div className="flex max-h-72 w-56 flex-col gap-1.5 overflow-y-auto py-0.5">
                {aires.map((aire) => {
                  const isActive = currentAireId === aire.id;
                  return (
                    <Link
                      key={aire.id}
                      href={`/station/${aire.id}/dashboard`}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                        isActive
                          ? "border-amber-500/50 bg-amber-600/15 text-amber-300"
                          : "border-transparent bg-slate-900/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <MapPin
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          isActive ? "text-amber-400" : "text-amber-500/70"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold leading-tight text-white">
                          {aire.name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {aire.address ?? aire.city ?? "Adresse non renseignée"}
                        </p>
                        <p className="mt-0.5 text-[9px] font-bold uppercase text-slate-600">
                          Zone {aire.schoolZone}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
