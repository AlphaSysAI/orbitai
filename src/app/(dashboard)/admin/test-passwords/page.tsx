// Copyright © 2026 OrbitSys. Tous droits réservés.

import { TestPasswordManager } from "@/features/admin/components/TestPasswordManager";

export const metadata = {
  title: "Mots de passe de test — Admin",
};

export default function TestPasswordsPage() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <TestPasswordManager />
      </div>
    </div>
  );
}
