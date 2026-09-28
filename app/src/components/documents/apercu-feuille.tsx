import * as React from "react";
import { cn } from "@/lib/utils";

/** Réduit une feuille A4 (210 mm) à la largeur disponible, sans la reformater. */
export function ApercuFeuille({ children }: { children: React.ReactNode }) {
  const cadre = React.useRef<HTMLDivElement>(null);
  const feuille = React.useRef<HTMLDivElement>(null);
  const [k, setK] = React.useState(1);
  const [h, setH] = React.useState<number>();
  React.useEffect(() => {
    const ajuster = () => {
      if (!cadre.current || !feuille.current) return;
      const kk = Math.min(1, cadre.current.clientWidth / feuille.current.offsetWidth);
      setK(kk); setH(feuille.current.offsetHeight * kk);
    };
    ajuster();
    const ro = new ResizeObserver(ajuster);
    if (cadre.current) ro.observe(cadre.current);
    if (feuille.current) ro.observe(feuille.current);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={cadre} className="w-full overflow-hidden" style={{ height: h }}>
      <div ref={feuille} className={cn("origin-top-left [&>.feuille]:m-0 [&>.feuille]:w-[210mm] [&>.feuille]:max-w-none")} style={{ transform: `scale(${k})`, width: "210mm" }}>{children}</div>
    </div>
  );
}
