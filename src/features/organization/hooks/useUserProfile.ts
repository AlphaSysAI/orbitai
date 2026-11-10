// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getCurrentUserProfile,
  type CurrentUserProfile,
} from "@/features/organization/actions/user-profile";

export function useUserProfile() {
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const result = await getCurrentUserProfile();
    if (result.success) {
      setProfile(result.data);
    } else {
      setProfile(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, isLoading, refresh };
}
