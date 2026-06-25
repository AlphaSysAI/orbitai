// Copyright © 2026 OrbitSys. Tous droits réservés.

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: "userId requis" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Vérifier s'il y a eu des activités dans le passé (même anciennes)
    const { count: totalActivities } = await supabase
      .from('user_actions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', 'activity_snapshot');

    const hasEverTracked = (totalActivities || 0) > 0;

    // Vérifier la dernière activité enregistrée (moins de 2 minutes = actif)
    const { data: activities } = await supabase
      .from('user_actions')
      .select('timestamp')
      .eq('user_id', userId)
      .eq('action_type', 'activity_snapshot')
      .order('timestamp', { ascending: false })
      .limit(1);

    const lastActivity = activities && activities.length > 0 ? activities[0] : null;

    if (!lastActivity) {
      return NextResponse.json({
        isActive: false,
        lastActivity: null,
        hasEverTracked,
        message: hasEverTracked 
          ? "Aucune activité récente enregistrée"
          : "Aucune activité enregistrée"
      });
    }

    const lastActivityTime = new Date(lastActivity.timestamp);
    const now = new Date();
    const minutesSinceLastActivity = (now.getTime() - lastActivityTime.getTime()) / 1000 / 60;

    const isActive = minutesSinceLastActivity < 2; // Actif si dernière activité il y a moins de 2 minutes

    return NextResponse.json({
      isActive,
      lastActivity: lastActivity.timestamp,
      hasEverTracked,
      minutesSinceLastActivity: Math.round(minutesSinceLastActivity),
      message: isActive 
        ? `Tracking actif (dernière activité il y a ${Math.round(minutesSinceLastActivity)} min)`
        : `Tracking inactif (dernière activité il y a ${Math.round(minutesSinceLastActivity)} min)`
    });
  } catch (error: any) {
    console.error("❌ ERREUR TRACKING STATUS:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la vérification" },
      { status: 500 }
    );
  }
}

