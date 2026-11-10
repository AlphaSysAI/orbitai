// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { requireOrgAdminContext } from "@/lib/organizations/org-context";
import { ShiftConfigPanel } from "@/features/regiaire/shift/components/ShiftConfigPanel";

export default async function EquipeConfigPage({
  params,
}: {
  params: Promise<{ aireId: string }>;
}) {
  const { aireId } = await params;

  const ctx = await requireOrgAdminContext().catch(() => null);
  if (!ctx) {
    redirect(`/station/${aireId}/equipe`);
  }

  return <ShiftConfigPanel />;
}
