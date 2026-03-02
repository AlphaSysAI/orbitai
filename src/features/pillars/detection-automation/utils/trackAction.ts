/**
 * Utilitaire pour enregistrer les actions utilisateur dans l'historique
 * Cela permet de détecter les patterns répétitifs
 */

import { createClient } from "@/utils/supabase/client";

export type ActionType = 
  | 'document_upload'
  | 'message_sent'
  | 'task_created'
  | 'automation_created'
  | 'automation_executed'
  | 'file_processed'
  | 'report_generated'
  | 'simulation_created';

interface ActionMetadata {
  [key: string]: any;
}

export async function trackAction(
  userId: string,
  actionType: ActionType,
  metadata: ActionMetadata = {}
): Promise<void> {
  try {
    const supabase = createClient();
    
    await supabase
      .from('user_actions')
      .insert({
        user_id: userId,
        action_type: actionType,
        metadata: metadata,
      });
    
    // En arrière-plan, pas besoin d'attendre ou de gérer les erreurs
  } catch (error) {
    // Échec silencieux pour ne pas perturber le flux principal
    console.error("Erreur enregistrement action:", error);
  }
}





