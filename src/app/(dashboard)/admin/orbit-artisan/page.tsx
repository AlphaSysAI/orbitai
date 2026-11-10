// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AdminSaasHeader } from "@/features/admin/components/AdminSaasHeader";
import { SaasClientCreation } from "@/features/admin/components/SaasClientCreation";

export default function AdminOrbitArtisanPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AdminSaasHeader
          title="Orbit Artisan"
          subtitle="Créez un compte artisan (devis & factures augmentés par l'IA)."
        />
        <SaasClientCreation
          vertical="artisan_core"
          verticalLabel="Orbit Artisan"
          sectorPlaceholder="Ex. Plomberie, électricité, maçonnerie"
        />
      </div>
    </div>
  );
}
