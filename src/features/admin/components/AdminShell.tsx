// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";

import { AdminSubNav } from "@/features/admin/components/AdminSubNav";
import { requireAdminUser } from "@/lib/admin/is-admin";

export async function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    if (admin.reason === "unauthenticated") redirect("/login");
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-200">
      <header className="border-b border-slate-800 bg-[#0f172a]/80 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-600/20 p-2">
              <Shield size={20} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase italic tracking-tighter text-white">
                Administration OrbitAI
              </h1>
              <p className="text-[10px] text-slate-500">{admin.user.email}</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200"
          >
            <ArrowLeft size={14} />
            Retour app
          </Link>
        </div>
        <AdminSubNav />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
