"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { ForcePasswordChangeModal } from "@/components/auth/ForcePasswordChangeModal";
import { userMustChangePassword } from "@/lib/auth/password-change";
import { createClient } from "@/utils/supabase/client";

export function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [mustChange, setMustChange] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const syncFromUser = (user: User | null) => {
      setMustChange(userMustChangePassword(user?.user_metadata));
      setIsChecking(false);
    };

    void supabase.auth.getUser().then(({ data }) => {
      syncFromUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (isChecking) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {mustChange && (
        <ForcePasswordChangeModal onComplete={() => setMustChange(false)} />
      )}
    </>
  );
}
