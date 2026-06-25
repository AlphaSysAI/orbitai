// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { ModuleDisabled } from "@/features/regiaire/components/ModuleDisabled";
import { requireRegiaireAccess } from "@/lib/organizations/access";

export default async function StationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireRegiaireAccess();

  if (!access.allowed) {
    if (access.reason === "unauthenticated") {
      redirect("/login");
    }
    return <ModuleDisabled moduleLabel="RégiAire" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
