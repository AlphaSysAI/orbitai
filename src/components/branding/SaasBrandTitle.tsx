// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { SaasBrand } from "@/lib/organizations/saas-branding";

type SaasBrandTitleProps = {
  brand: SaasBrand;
  className?: string;
  /** Taille du wordmark */
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-4xl",
} as const;

export function SaasBrandTitle({
  brand,
  className = "",
  size = "md",
}: SaasBrandTitleProps) {
  return (
    <span
      className={`inline font-bold tracking-tighter uppercase italic ${SIZE_CLASS[size]} ${className}`}
    >
      {brand.parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.highlight ? "text-purple-500" : "text-white"}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}
