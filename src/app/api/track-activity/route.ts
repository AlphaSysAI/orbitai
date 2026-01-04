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
    const { userId, activity } = await req.json();

    if (!userId || !activity) {
      return NextResponse.json(
        { error: "userId et activity requis" },
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

    // Enregistrer l'action dans user_actions
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

    // Analyser périodiquement pour détecter les patterns (toutes les X minutes)
    // Pour l'instant, on enregistre juste les données

    return NextResponse.json({
      success: true,
      message: "Activité enregistrée",
    });
  } catch (error: any) {
    console.error("❌ ERREUR TRACK ACTIVITY:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'enregistrement" },
      { status: 500 }
    );
  }
}

