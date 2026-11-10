// Copyright © 2026 OrbitSys. Tous droits réservés.

import { DashboardShell } from "@/features/pillars/components/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
