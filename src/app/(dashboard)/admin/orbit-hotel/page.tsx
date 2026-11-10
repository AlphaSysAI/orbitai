// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AdminSaasHeader } from "@/features/admin/components/AdminSaasHeader";
import { SaasClientCreation } from "@/features/admin/components/SaasClientCreation";

export default function AdminOrbitHotelPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 space-y-6">
        <AdminSaasHeader
          title="Orbit Hôtel"
          subtitle="Créez un compte hôtelier. L'application Orbit Hôtel (PMS + orchestration IA) arrive prochainement."
        />
        <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-sky-200">
          Module en cours de développement : le compte et ses accès sont créés dès maintenant,
          l&apos;application métier sera disponible dans une prochaine version.
        </p>
        <SaasClientCreation
          vertical="hotel_core"
          verticalLabel="Orbit Hôtel"
          sectorPlaceholder="Ex. Hôtellerie"
        />
      </div>
    </div>
  );
}
