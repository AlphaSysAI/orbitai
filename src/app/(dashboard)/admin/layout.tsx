// Copyright © 2026 OrbitSys. Tous droits réservés.

import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/admin/is-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    if (admin.reason === "unauthenticated") redirect("/login");
    redirect("/");
  }

  return <>{children}</>;
}
