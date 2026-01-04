import { createClient } from '@/utils/supabase/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Une fois connecté, on renvoie l'utilisateur vers le dashboard principal
  return NextResponse.redirect(requestUrl.origin);
}