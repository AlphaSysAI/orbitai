// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AdminSaasHeader } from "@/features/admin/components/AdminSaasHeader";
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
          subtitle="Gérez les aires de service de cette entité et les modules activés par aire."
          backHref="/admin/orbit-aire"
          backLabel="Orbit Aire"
        />
        <AireEntityManager organizationId={orgId} />
      </div>
    </div>
  );
}
