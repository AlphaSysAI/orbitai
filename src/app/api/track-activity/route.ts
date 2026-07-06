// Copyright © 2026 OrbitSys. Tous droits réservés.

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import {
  extractBearerToken,
  verifyTrackerToken,
  TrackerTokenError,
} from '@/server/auth/tracker-token';

export const runtime = 'edge';

interface ActivityData {
  active_window?: {
    application: string;
    window_title: string;
    timestamp: string;
  };
  running_applications?: Array<{
    name: string;
    timestamp: string;
  }>;
  mail_stats?: {
    total_mails: number;
    unread_mails: number;
    timestamp: string;
  };
  browser_tabs?: Array<{
    url: string;
    title: string;
    browser: string;
    timestamp: string;
  }>;
  system_time: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId: bodyUserId, activity, activities, current_session } = body;

    // Authentification via token HMAC (si TRACKER_SIGNING_SECRET configuré).
    // En l'absence du secret (dev / legacy), on accepte userId du body mais on
    // valide qu'il est bien un UUID.
    let userId: string;
    const signingSecretSet = Boolean(process.env.TRACKER_SIGNING_SECRET);

    if (signingSecretSet) {
      const token = extractBearerToken(req.headers.get("authorization"));
      if (!token) {
        return NextResponse.json({ error: "Authorization requis" }, { status: 401 });
      }
      try {
        const payload = await verifyTrackerToken(token);
        userId = payload.userId;
      } catch (err) {
        if (err instanceof TrackerTokenError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
      }
    } else {
      if (!bodyUserId || typeof bodyUserId !== "string") {
        return NextResponse.json({ error: "userId requis" }, { status: 400 });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bodyUserId)) {
        return NextResponse.json({ error: "userId invalide" }, { status: 400 });
      }
      userId = bodyUserId as string;
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

    // Format nouveau (avec pynput) - activités événementielles
    if (activities && Array.isArray(activities)) {
      // Enregistrer chaque activité
      for (const act of activities) {
        await supabase.from('user_actions').insert({
          user_id: userId,
          action_type: act.type || 'activity_event',
          metadata: {
            timestamp: act.timestamp,
            session_id: act.session_id,
            event_type: act.type,
            details: act.details,
            current_session: current_session || null,
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `${activities.length} activité(s) enregistrée(s)`,
        count: activities.length,
      });
    }

    // Format ancien (compatibilité) - snapshot périodique
    if (activity) {
      await supabase.from('user_actions').insert({
        user_id: userId,
        action_type: 'activity_snapshot',
        metadata: {
          active_window: activity.active_window,
          applications_count: activity.running_applications?.length || 0,
          applications: activity.running_applications?.map((app: any) => app.name) || [],
          mail_stats: activity.mail_stats,
          browser_tabs_count: activity.browser_tabs?.length || 0,
          system_time: activity.system_time,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Activité enregistrée",
      });
    }

    return NextResponse.json(
      { error: "activity ou activities requis" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("❌ ERREUR TRACK ACTIVITY:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'enregistrement" },
      { status: 500 }
    );
  }
}


