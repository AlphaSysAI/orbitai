// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AdminSaasHeader } from "@/features/admin/components/AdminSaasHeader";
import { OrbitAireAdminPanel } from "@/features/admin/components/OrbitAireAdminPanel";
import { AireEntityManager } from "@/features/admin/components/AireEntityManager";

export default async function AdminOrbitAireEntityPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AdminSaasHeader
          title="Administration de l'entité"
          subtitle="Créez la hiérarchie (directeur régional, chef de secteur, gérant) et gérez les aires et leurs modules."
          backHref="/admin/orbit-aire"
          backLabel="Orbit Aire"
        />
        <div className="space-y-10">
          <OrbitAireAdminPanel lockedOrgId={orgId} />
          <AireEntityManager organizationId={orgId} />
        </div>
      </div>
    </div>
  );
}
