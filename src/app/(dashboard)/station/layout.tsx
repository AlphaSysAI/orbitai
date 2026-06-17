import { redirect } from "next/navigation";

import { ModuleDisabled } from "@/features/regiaire/components/ModuleDisabled";
import { StationSubNav } from "@/features/regiaire/components/StationSubNav";
import { requireRegiaireAccess } from "@/lib/organizations/access";

export default async function StationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireRegiaireAccess();

  if (!access.allowed) {
    if (access.reason === "unauthenticated") {
      redirect("/login");
    }
    return <ModuleDisabled moduleLabel="RégiAire" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#020617] text-slate-200">
      <StationSubNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
