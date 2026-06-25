// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";

import type { EnabledOrgModule } from "@/lib/organizations/types";

type ModulesResponse = {
  organization: { id: string; name: string } | null;
  modules: string[];
  enabledModules: EnabledOrgModule[];
};

export function useOrganizationModules() {
  const [enabledModules, setEnabledModules] = useState<EnabledOrgModule[]>([]);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/organizations/modules");
        if (!res.ok) {
          if (!cancelled) setEnabledModules([]);
          return;
        }
        const data = (await res.json()) as ModulesResponse;
        if (!cancelled) {
          setEnabledModules(data.enabledModules ?? []);
          setOrganizationName(data.organization?.name ?? null);
        }
      } catch {
        if (!cancelled) setEnabledModules([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabledModules, organizationName, isLoading };
}
