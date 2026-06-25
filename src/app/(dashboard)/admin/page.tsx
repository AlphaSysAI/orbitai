// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AdminClientPanel } from "@/features/admin/components/AdminClientPanel";

export default function AdminPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <AdminClientPanel />
      </div>
    </div>
  );
}
