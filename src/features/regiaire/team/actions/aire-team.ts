// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { z } from "zod";

import {
  createAireEmployee,
  listAireTeamMembers,
  removeAireEmployee,
  type AireTeamMember,
  type CreateAireEmployeeResult,
} from "@/lib/regiaire/aire-team";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

const CreateEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export type ListAireTeamActionResult =
  | { success: true; data: AireTeamMember[] }
  | { success: false; error: string; code?: string };

export type CreateAireEmployeeActionResult =
  | { success: true; data: CreateAireEmployeeResult }
  | { success: false; error: string; code?: string };

export type RemoveAireEmployeeActionResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export async function listAireTeam(
  aireId: string
): Promise<ListAireTeamActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const data = await listAireTeamMembers(ctx);
    return { success: true, data };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement";
    return { success: false, error: message };
  }
}

export async function createAireTeamEmployee(
  aireId: string,
  input: z.infer<typeof CreateEmployeeSchema>
): Promise<CreateAireEmployeeActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const parsed = CreateEmployeeSchema.parse(input);
    const data = await createAireEmployee(ctx, parsed);
    return { success: true, data };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la création";
    return { success: false, error: message };
  }
}

export async function removeAireTeamEmployee(
  aireId: string,
  memberUserId: string
): Promise<RemoveAireEmployeeActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    await removeAireEmployee(ctx, memberUserId);
    return { success: true };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la suppression";
    return { success: false, error: message };
  }
}
