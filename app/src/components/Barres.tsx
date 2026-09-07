// Graphique à barres minimal (SVG pour les barres, libellés en HTML pour éviter toute déformation du texte).
export function Barres({ data, hauteur = 180, couleur = "var(--green)", format = (n: number) => String(n) }: {
  data: { label: string; value: number; key?: string }[]; hauteur?: number; couleur?: string; format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const largeur = 100 / n;
  return (
    <div className="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: hauteur, display: "block" }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 96;
          return <rect key={d.key ?? d.label} x={i * largeur + largeur * 0.15} y={100 - h} width={largeur * 0.7} height={h} fill={couleur} />;
        })}
      </svg>
      <div className="chart-labels" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {data.map((d) => <div key={d.key ?? d.label}><b>{d.label}</b><span>{format(d.value)}</span></div>)}
      </div>
    </div>
  );
}
