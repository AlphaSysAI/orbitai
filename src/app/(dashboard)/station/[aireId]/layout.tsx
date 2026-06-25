// Copyright © 2026 OrbitSys. Tous droits réservés.

import { RegiaireHeader } from "@/features/regiaire/components/RegiaireHeader";
import { RegiaireRouteGuard } from "@/features/regiaire/components/RegiaireRouteGuard";
import { loadRegiaireHeaderSnapshot } from "@/features/regiaire/lib/header-snapshot";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ aireId: string }>;
};

export default async function AireLayout({ children, params }: LayoutProps) {
  const { aireId } = await params;

  let headerSnapshot = null;
  try {
    headerSnapshot = await loadRegiaireHeaderSnapshot(aireId);
  } catch {
    headerSnapshot = null;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <RegiaireHeader aireId={aireId} initial={headerSnapshot} />
      <div className="flex-1 overflow-y-auto">
        <RegiaireRouteGuard aireId={aireId}>{children}</RegiaireRouteGuard>
      </div>
    </div>
  );
}
