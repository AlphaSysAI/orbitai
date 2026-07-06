// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { ModuleDisabled } from "@/features/regiaire/components/ModuleDisabled";
import { requireHotelAccess } from "@/lib/organizations/access";
import { HotelInvoicesList } from "@/features/hotel/components/HotelInvoicesList";

export default async function HotelInvoicesPage() {
  const access = await requireHotelAccess();
  if (!access.allowed) {
    if (access.reason === "unauthenticated") redirect("/login");
    return <ModuleDisabled moduleLabel="Orbit Hôtel" />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <HotelInvoicesList />
      </div>
    </div>
  );
}
