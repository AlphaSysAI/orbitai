"use client";

import { useParams } from "next/navigation";

export function useRegiaireAireId(): string {
  const params = useParams();
  const aireId = params?.aireId;

  if (typeof aireId !== "string" || !aireId) {
    throw new Error("Paramètre aireId manquant dans l'URL");
  }

  return aireId;
}
