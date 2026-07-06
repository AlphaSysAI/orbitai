// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BisonFuteCalendarPanel } from "@/features/admin/bison-fute/components/BisonFuteCalendarPanel";

export default function AdminBisonFutePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link
          href="/admin/orbit-aire"
          className="mb-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200"
        >
          <ArrowLeft size={14} />
          Orbit Aire
        </Link>
        <BisonFuteCalendarPanel />
      </div>
    </div>
  );
}
