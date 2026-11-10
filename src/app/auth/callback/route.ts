// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import { createRouteHandlerSupabaseClient } from "@/server/auth/supabase-server";

const LOGIN_ERROR_REDIRECT = "/login?error=auth_callback_failed";

function buildRedirectUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) {
    console.error("[auth/callback] Fournisseur OAuth a renvoyé une erreur.");
    return NextResponse.redirect(buildRedirectUrl(origin, LOGIN_ERROR_REDIRECT));
  }

  if (!code) {
    console.error("[auth/callback] Paramètre code absent.");
    return NextResponse.redirect(buildRedirectUrl(origin, LOGIN_ERROR_REDIRECT));
  }

  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession a échoué.");
      return NextResponse.redirect(buildRedirectUrl(origin, LOGIN_ERROR_REDIRECT));
    }

    // `next` est validé : seules les URL relatives sont acceptées
    const safeNext = next.startsWith("/") ? next : "/";
    return NextResponse.redirect(buildRedirectUrl(origin, safeNext));
  } catch (err) {
    console.error("[auth/callback] Erreur inattendue.", err);
    return NextResponse.redirect(buildRedirectUrl(origin, LOGIN_ERROR_REDIRECT));
  }
}
