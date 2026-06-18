"use client";

import { useCallback, useEffect, useState } from "react";

import { getOrgRole } from "@/features/organization/actions";

export function useOrgRole() {
  const [role, setRole] = useState<string | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getOrgRole();
    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }
    setRole(result.role);
    setIsOrgAdmin(result.isOrgAdmin);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { role, isOrgAdmin, isLoading, error, refresh };
}
