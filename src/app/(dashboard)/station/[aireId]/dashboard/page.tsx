// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AireDashboard } from "@/features/regiaire/components/AireDashboard";

type PageProps = {
  params: Promise<{ aireId: string }>;
};

export default async function AireDashboardPage({ params }: PageProps) {
  const { aireId } = await params;
  return <AireDashboard aireId={aireId} />;
}
