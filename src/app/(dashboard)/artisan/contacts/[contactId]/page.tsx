// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { ModuleDisabled } from "@/features/regiaire/components/ModuleDisabled";
import { requireArtisanAccess } from "@/lib/organizations/access";
import { ArtisanContactDetail } from "@/features/artisan/components/ArtisanContactDetail";

export default async function ArtisanContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const access = await requireArtisanAccess();
  if (!access.allowed) {
    if (access.reason === "unauthenticated") redirect("/login");
    return <ModuleDisabled moduleLabel="Orbit Artisan" />;
  }

  const { contactId } = await params;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <ArtisanContactDetail contactId={contactId} />
      </div>
    </div>
  );
}
