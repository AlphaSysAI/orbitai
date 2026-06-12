import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    const { userId, activity, activities, current_session } = body;

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


