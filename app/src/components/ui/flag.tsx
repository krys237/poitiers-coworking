import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const flagVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border transition-colors font-sans",
  {
    variants: {
      variant: {
        // Canaux de paiement (pastilles lisses épurées sans point générique)
        om: "border-orange-200/80 bg-orange-50/70 text-orange-800 shadow-2xs font-semibold",
        momo: "border-amber-200/80 bg-amber-50/70 text-amber-900 shadow-2xs font-semibold",
        especes: "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 shadow-2xs font-semibold",
        finance: "border-blue-200/80 bg-blue-50/70 text-[#0077b6] shadow-2xs font-semibold",
        
        // Statuts opérationnels
        "saisie-active": "border-ocean-ceruleen/40 bg-ocean-profond text-white shadow-xs font-bold",
        "a-renseigner": "border-amber-300/80 border-dashed bg-amber-50/80 text-amber-900 shadow-2xs font-semibold",
        renseigne: "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 shadow-2xs font-semibold",
        direct: "border-sky-300/80 bg-sky-50/80 text-sky-800 shadow-2xs font-semibold",
        verrou: "border-slate-200/90 bg-slate-100/80 text-slate-600 shadow-2xs font-medium",
        neutre: "border-slate-200/80 bg-slate-50/80 text-slate-700 shadow-2xs font-medium",
        recette: "border-white/25 bg-white/20 text-white font-semibold shadow-2xs",
      },
      size: {
        xs: "px-2 py-0.5 text-[9px] leading-tight",
        sm: "px-2.5 py-0.5 text-[10px] leading-tight tracking-wide",
        md: "px-3 py-1 text-xs leading-tight tracking-wide",
      },
    },
    defaultVariants: {
      variant: "neutre",
      size: "sm",
    },
  }
);

export type FlagVariant = NonNullable<VariantProps<typeof flagVariants>["variant"]>;

export interface FlagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof flagVariants> {
  icon?: React.ReactNode;
}

export function Flag({
  className,
  variant = "neutre",
  size = "sm",
  icon,
  children,
  ...props
}: FlagProps) {
  return (
    <span
      className={cn(flagVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span className="shrink-0 leading-none">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
