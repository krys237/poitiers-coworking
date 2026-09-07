const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export function PeriodePicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  const [y, m] = value.split("-");
  const annees = Array.from({ length: 7 }, (_, i) => 2023 + i);
  return (
    <span className="no-print" style={{ display: "inline-flex", gap: 6 }}>
      <select value={m} onChange={(e) => onChange(`${y}-${e.target.value}`)}>
        {MOIS.map((n, i) => <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
      </select>
      <select value={y} onChange={(e) => onChange(`${e.target.value}-${m}`)}>
        {annees.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </span>
  );
}
