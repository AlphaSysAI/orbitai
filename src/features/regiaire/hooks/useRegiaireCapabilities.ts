// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";

import { getRegiaireCapabilities } from "@/features/regiaire/actions/get-regiaire-capabilities";
import type { RegiaireCapabilities } from "@/lib/regiaire/regiaire-capabilities";

export function useRegiaireCapabilities(aireId: string | null) {
  const [capabilities, setCapabilities] = useState<RegiaireCapabilities | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(Boolean(aireId));

  useEffect(() => {
    if (!aireId) {
      setCapabilities(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const res = await getRegiaireCapabilities(aireId);
      if (cancelled) return;
      setCapabilities(res.success ? res.data : null);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [aireId]);

  return { capabilities, isLoading };
}
