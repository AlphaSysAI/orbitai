// Copyright © 2026 OrbitSys. Tous droits réservés.

import { ChefDetailView } from "@/features/regiaire/region/components/ChefDetailView";

export default async function RegionChefPage({
  params,
}: {
  params: Promise<{ chefUserId: string }>;
}) {
  const { chefUserId } = await params;
  return <ChefDetailView chefUserId={chefUserId} />;
}
