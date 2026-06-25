// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";
import { DELIVERY_STATUS_META } from "@/features/regiaire/reception/utils/delivery-ui";

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const meta = DELIVERY_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
