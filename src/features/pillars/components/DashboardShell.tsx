// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { type PillarId, PILLARS } from "@/features/pillars/types";
import { ContextualNavigation } from "@/features/pillars/components/ContextualNavigation";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { PasswordChangeGate } from "@/components/auth/PasswordChangeGate";
import {
  DashboardShellProvider,
  type DashboardTab,
} from "@/features/pillars/components/DashboardShellContext";
import { useOrganizationModules } from "@/hooks/useOrganizationModules";
import { resolveSaasBrandFromModules } from "@/lib/organizations/saas-branding";
import { SaasBrandTitle } from "@/components/branding/SaasBrandTitle";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [activePillar, setActivePillar] = useState<PillarId>("emotional-ai");
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [copilotThreads, setCopilotThreads] = useState<
    Array<{ id_thread: string; title: string; created_at?: string }>
  >([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteThreadFn, setDeleteThreadFn] = useState<
    ((threadId: string, e: React.MouseEvent) => Promise<void>) | null
  >(null);
  // Drawer de navigation mobile (off-canvas). Sidebar statique dès `lg:`.
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { enabledModules } = useOrganizationModules();
  const saasBrand = resolveSaasBrandFromModules(enabledModules);

  useEffect(() => {
    const initSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          // Session absente ou refresh token invalide : on purge la session
          // locale (stoppe les tentatives de refresh) et on renvoie au login.
          await supabase.auth.signOut().catch(() => undefined);
          router.push("/login");
          return;
        }
        setUser(session.user);
      } catch {
        await supabase.auth.signOut().catch(() => undefined);
        router.push("/login");
      }
    };
    void initSession();

    // Renvoie au login si le rafraîchissement du token échoue en arrière-plan.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.push("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, supabase]);

  // Ferme le drawer mobile à chaque navigation d'URL (liens station/admin).
  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  // Espace admin pur : un administrateur plateforme est redirigé vers /admin
  // (il n'utilise pas l'app piliers/modules).
  const isAdminRoute = pathname.startsWith("/admin");
  useEffect(() => {
    if (!isAdminLoading && isAdmin && !isAdminRoute) {
      router.replace("/admin");
    }
  }, [isAdmin, isAdminLoading, isAdminRoute, router]);

  if (!user) {
    return null;
  }

  // Évite d'afficher brièvement l'app piliers avant la redirection admin.
  if (isAdmin && !isAdminRoute) {
    return null;
  }

  const goHomeIfNeeded = () => {
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const handlePillarChange = (pillarId: PillarId) => {
    const pillar = PILLARS.find((p) => p.id === pillarId);
    if (pillar?.enabled) {
      setActivePillar(pillarId);
      if (pillarId === "detection-automation") {
        setActiveTab("overview");
      } else {
        setActiveTab("dashboard");
      }
      setIsNavOpen(false);
      goHomeIfNeeded();
    }
  };

  const handleDashboardClick = () => {
    setActiveTab("dashboard");
    setIsNavOpen(false);
    if (
      activePillar === "copilot-transmission" ||
      activePillar === "decision-simulation" ||
      activePillar === "detection-automation" ||
      activePillar === "client-synthesis"
    ) {
      const defaultPillar = PILLARS.find(
        (p) =>
          p.id !== "copilot-transmission" &&
          p.id !== "decision-simulation" &&
          p.id !== "detection-automation" &&
          p.id !== "client-synthesis"
      );
      if (defaultPillar) {
        setActivePillar(defaultPillar.id);
      }
    }
    goHomeIfNeeded();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleThreadClickFromNav = (threadId: string) => {
    setActiveThreadId(threadId);
    if (activeTab !== "dashboard") {
      setActiveTab("dashboard");
    }
    goHomeIfNeeded();
  };

  const handleThreadDeleteFromNav = async (
    threadId: string,
    e: React.MouseEvent
  ) => {
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    if (deleteThreadFn) {
      await deleteThreadFn(threadId, e);
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setIsNavOpen(false);
    goHomeIfNeeded();
  };

  const contextValue = {
    user,
    activePillar,
    activeTab,
    setActivePillar,
    setActiveTab,
    handlePillarChange,
    handleTabChange,
    handleDashboardClick,
    handleLogout,
    copilotThreads,
    setCopilotThreads,
    activeThreadId,
    setActiveThreadId,
    setDeleteThreadFn,
  };

  // L'administration OrbitAll est un espace pur : barre de gauche dédiée
  // (Dashboard + les 3 SaaS Orbit), sans piliers ni modules.
  if (isAdminRoute) {
    return (
      <PasswordChangeGate>
        <DashboardShellProvider value={contextValue}>
          <div className="flex h-screen overflow-hidden bg-[#020617] font-sans text-slate-200">
            {isNavOpen && (
              <div
                onClick={() => setIsNavOpen(false)}
                aria-hidden
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
              />
            )}
            <AdminSidebar
              isOpen={isNavOpen}
              onClose={() => setIsNavOpen(false)}
              onLogout={handleLogout}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
              <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0f172a] px-4 lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsNavOpen(true)}
                  aria-label="Ouvrir le menu"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  <Menu size={22} />
                </button>
                <span className="text-sm font-black uppercase italic tracking-tighter text-white">
                  OrbitAll Admin
                </span>
              </div>
              {children}
            </div>
          </div>
        </DashboardShellProvider>
      </PasswordChangeGate>
    );
  }

  return (
    <PasswordChangeGate>
      <DashboardShellProvider value={contextValue}>
        <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
          {/* Overlay sombre derrière le drawer (mobile uniquement) */}
          {isNavOpen && (
            <div
              onClick={() => setIsNavOpen(false)}
              aria-hidden
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            />
          )}
          <ContextualNavigation
            isOpen={isNavOpen}
            onClose={() => setIsNavOpen(false)}
            activePillar={activePillar}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
            userEmail={user.email}
            threads={
              activePillar === "copilot-transmission" ? copilotThreads : undefined
            }
            activeThreadId={
              activePillar === "copilot-transmission" ? activeThreadId : undefined
            }
            onThreadClick={
              activePillar === "copilot-transmission"
                ? handleThreadClickFromNav
                : undefined
            }
            onThreadDelete={
              activePillar === "copilot-transmission"
                ? handleThreadDeleteFromNav
                : undefined
            }
            onDashboardClick={handleDashboardClick}
            enabledModules={enabledModules}
          />
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white overflow-hidden">
            {/* Barre mobile : hamburger d'ouverture du drawer (cachée dès lg) */}
            <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0f172a] px-4 lg:hidden">
              <button
                type="button"
                onClick={() => setIsNavOpen(true)}
                aria-label="Ouvrir le menu"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 hover:text-white"
              >
                <Menu size={22} />
              </button>
              <SaasBrandTitle brand={saasBrand} size="sm" />
            </div>
            {children}
          </div>
        </div>
      </DashboardShellProvider>
    </PasswordChangeGate>
  );
}
