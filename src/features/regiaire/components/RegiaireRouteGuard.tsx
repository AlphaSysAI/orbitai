// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { getRegiaireCapabilities } from "@/features/regiaire/actions/get-regiaire-capabilities";
import {
  defaultRegiaireLandingPath,
  isRegiairePathAllowed,
} from "@/lib/regiaire/route-access";

export function RegiaireRouteGuard({
  aireId,
  children,
}: {
  aireId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const res = await getRegiaireCapabilities(aireId);
      if (cancelled) return;

      if (!res.success) {
        router.replace("/station");
        return;
      }

      if (!isRegiairePathAllowed(pathname, aireId, res.data)) {
        router.replace(defaultRegiaireLandingPath(aireId, res.data));
        return;
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [aireId, pathname, router]);

  if (!ready) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={28} />
      </div>
    );
  }

  return <>{children}</>;
}
