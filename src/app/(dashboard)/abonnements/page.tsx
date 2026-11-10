// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { getOrgFeatureState } from "@/features/organization/actions/features";
import { FeatureCatalog } from "@/features/organization/components/FeatureCatalog";

export const metadata = {
  title: "Abonnements — OrbitAll",
};

export default async function AbonnementsPage() {
  const state = await getOrgFeatureState();

  if (!state.success) {
    if (state.code === "unauthenticated") redirect("/login");
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-red-300">{state.error}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <FeatureCatalog
        initialEnabled={state.data.enabledFeatureIds}
        isOrgAdmin={state.data.isOrgAdmin}
      />
    </div>
  );
}
