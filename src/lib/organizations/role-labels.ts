// Copyright © 2026 OrbitSys. Tous droits réservés.

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
  employe: "Employé",
};

export function formatOrgRoleLabel(role: string | null | undefined): string {
  if (!role) return "Utilisateur";
  return ORG_ROLE_LABELS[role] ?? role;
}
