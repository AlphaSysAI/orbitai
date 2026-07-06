// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { ModuleDisabled } from "@/features/regiaire/components/ModuleDisabled";
import { requireHotelAccess } from "@/lib/organizations/access";
import { HotelPlanning } from "@/features/hotel/components/HotelPlanning";

export default async function HotelPlanningPage() {
  const access = await requireHotelAccess();
  if (!access.allowed) {
    if (access.reason === "unauthenticated") redirect("/login");
    return <ModuleDisabled moduleLabel="Orbit Hôtel" />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <HotelPlanning />
      </div>
    </div>
  );
}
