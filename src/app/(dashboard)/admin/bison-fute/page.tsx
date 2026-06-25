// Copyright © 2026 OrbitSys. Tous droits réservés.

import { BisonFuteCalendarPanel } from "@/features/admin/bison-fute/components/BisonFuteCalendarPanel";

export default function AdminBisonFutePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <BisonFuteCalendarPanel />
      </div>
    </div>
  );
}
