"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export function useRegiaireOrg() {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Session requise");
      setIsLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memberError || !membership?.organization_id) {
      setError("Organisation introuvable");
      setIsLoading(false);
      return;
    }

    setOrganizationId(membership.organization_id);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { organizationId, userId, isLoading, error, refresh };
}
