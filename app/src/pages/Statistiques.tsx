import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PeriodePicker } from "../components/PeriodePicker";
import { Barres } from "../components/Barres";
import { POSTES_ESPECES, LIBELLES_CAISSE, LIGNE_VIDE, CATEGORIES_PRIMES, LIBELLE_CATEGORIE, montantTotalPrime, parseCsvCaisse, exportCsvCaisse, parseCsvPrimes, exportCsvPrimes } from "../../convex/lib/stats";
import { fcfa, num, libellePeriode, periodeCourante, messageErreur } from "../lib/format";

type Onglet = "caisse" | "graphes" | (typeof CATEGORIES_PRIMES)[number][0];
const COLS = [...POSTES_ESPECES, "assurance", "tepScan", "sortiesDuJour"] as const;
const LIBELLE_COURT: Record<string, string> = { externes_labo_radio: "Externes", interpretes_scanner: "Int. Scanner", interpretes_irm: "Int. IRM", internes_examens: "Internes", prescripteurs_scanner: "Presc. Scanner", prescripteurs_irm: "Presc. IRM" };
const PRIME_VIDE = { designation: "", dateDebut: "", dateFin: "", actes: 0, montantUnitaire: 0, notes: "" };

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nom; a.click(); URL.revokeObjectURL(url);
}

export function Statistiques() {
  const [periode, setPeriode] = useState(periodeCourante());
  const [onglet, setOnglet] = useState<Onglet>("caisse");
  const caisse = useQuery(api.stats.caisse, { periode });
  const primes = useQuery(api.stats.primes, onglet !== "caisse" && onglet !== "graphes" ? { periode, categorie: onglet } : { periode });
  const graphes = useQuery(api.stats.graphes, { periode });
  const enregistrerLigne = useMutation(api.stats.enregistrerLigne);
  const supprimerLigne = useMutation(api.stats.supprimerLigne);
  const importerCaisse = useMutation(api.stats.importerCaisse);
  const enregistrerPrime = useMutation(api.stats.enregistrerPrime);
  const supprimerPrime = useMutation(api.stats.supprimerPrime);
  const importerPrimes = useMutation(api.stats.importerPrimes);

  const [fc, setFc] = useState<any>({ ...LIGNE_VIDE, ligneId: null });
  const [fp, setFp] = useState<any>({ ...PRIME_VIDE, primeId: null });
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sauverCaisse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { ligneId, ...l } = fc;
      const nums = Object.fromEntries(COLS.map((k) => [k, Number(l[k]) || 0]));
      await enregistrerLigne({ ligneId: ligneId ?? undefined, periode, dateDebut: l.dateDebut, dateFin: l.dateFin, horaires: l.horaires || undefined, ...(nums as any) });
      setMsg(ligneId ? "Ligne mise à jour." : "Ligne ajoutée — totaux recalculés."); setFc({ ...LIGNE_VIDE, ligneId: null });
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };
  const sauverPrime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onglet === "caisse" || onglet === "graphes") return;
    try {
      const { primeId, ...p } = fp;
      await enregistrerPrime({ primeId: primeId ?? undefined, periode, categorie: onglet, designation: p.designation, dateDebut: p.dateDebut || undefined, dateFin: p.dateFin || undefined, actes: Number(p.actes) || 0, montantUnitaire: Number(p.montantUnitaire) || 0, notes: p.notes || undefined });
      setMsg(primeId ? "Prime mise à jour." : `Prime ajoutée — montant ${fcfa(montantTotalPrime(Number(p.actes), Number(p.montantUnitaire)))}.`); setFp({ ...PRIME_VIDE, primeId: null });
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };
  const supprimer = async (id: string, prime: boolean) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    prime ? await supprimerPrime({ primeId: id as any }) : await supprimerLigne({ ligneId: id as any });
    setConfirmId(null); setMsg("Ligne supprimée.");
  };

  const importCsv = async (file: File) => {
    const t = await file.text();
    if (onglet === "caisse") { const l = parseCsvCaisse(t); if (!l.length) { setMsg("Aucune ligne reconnue."); return; } const r = await importerCaisse({ periode, lignes: l.map((x) => ({ ...x, horaires: x.horaires || undefined })) }); setMsg(`${r.importees} ligne(s) de caisse importée(s).`); }
    else if (onglet !== "graphes") { const l = parseCsvPrimes(t); if (!l.length) { setMsg("Aucune ligne reconnue."); return; } const r = await importerPrimes({ periode, categorie: onglet, lignes: l }); setMsg(`${r.importees} prime(s) importée(s).`); }
  };

  const t = caisse?.totaux ?? {};
  return (
    <>
      <h1>Statistiques &amp; primes</h1>
      <p className="sub">Tableau de caisse mensuel (total espèces et chiffre d'affaires calculés) et primes des médecins par catégorie (montant = actes × unitaire). Import / export CSV dans chaque onglet.</p>
      <div className="bar">
        <PeriodePicker value={periode} onChange={setPeriode} /><b>{libellePeriode(periode)}</b>
        <span className="grow" />
        {onglet !== "graphes" && <label className="btn">Importer CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} /></label>}
        {onglet === "caisse" && <button className="btn" disabled={!caisse?.lignes.length} onClick={() => telecharger(`caisse-${periode}.csv`, exportCsvCaisse(caisse!.lignes))}>Exporter CSV</button>}
        {onglet !== "caisse" && onglet !== "graphes" && <button className="btn" disabled={!primes?.lignes.length} onClick={() => telecharger(`primes-${onglet}-${periode}.csv`, exportCsvPrimes(primes!.lignes.map((l: any) => ({ ...l, actes: l.actes ?? 0, montantUnitaire: l.montantUnitaire ?? 0 }))))}>Exporter CSV</button>}
      </div>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={`tab ${onglet === "caisse" ? "active" : ""}`} onClick={() => setOnglet("caisse")}>Tableau statistique</button>
        {CATEGORIES_PRIMES.map(([k, l]) => <button key={k} className={`tab ${onglet === k ? "active" : ""}`} onClick={() => setOnglet(k)}>{l}</button>)}
        <button className={`tab ${onglet === "graphes" ? "active" : ""}`} onClick={() => setOnglet("graphes")}>Graphes</button>
      </div>
      {msg && <div className="note">{msg}</div>}

      {onglet === "caisse" && (<>
        <div className="cards">
          <div className="card"><div className="k">Total espèces</div><div className="v">{caisse ? fcfa(t.totalEspeces) : "…"}</div></div>
          <div className="card"><div className="k">Assurance + TEP scan</div><div className="v">{caisse ? fcfa((t.assurance ?? 0) + (t.tepScan ?? 0)) : "…"}</div></div>
          <div className="card"><div className="k">Chiffre d'affaires</div><div className="v" style={{ color: "var(--green)" }}>{caisse ? fcfa(t.chiffreAffaires) : "…"}</div></div>
          <div className="card"><div className="k">Sorties du jour (cumul)</div><div className="v" style={{ color: "var(--red)" }}>{caisse ? fcfa(t.sortiesDuJour) : "…"}</div></div>
        </div>
        <form className="form" onSubmit={sauverCaisse}>
          <label>Du<input type="date" value={fc.dateDebut} onChange={(e) => setFc({ ...fc, dateDebut: e.target.value })} required /></label>
          <label>Au<input type="date" value={fc.dateFin} onChange={(e) => setFc({ ...fc, dateFin: e.target.value })} required /></label>
          <label>Horaires<input value={fc.horaires ?? ""} onChange={(e) => setFc({ ...fc, horaires: e.target.value })} placeholder="8h–18h" /></label>
          {COLS.map((k) => <label key={k}>{LIBELLES_CAISSE[k]}<input type="number" min={0} value={fc[k]} onChange={(e) => setFc({ ...fc, [k]: e.target.value })} /></label>)}
          <label>&nbsp;<span style={{ display: "flex", gap: 6 }}><button className="btn primary" type="submit">{fc.ligneId ? "Mettre à jour" : "Ajouter la ligne"}</button>{fc.ligneId && <button type="button" className="btn" onClick={() => setFc({ ...LIGNE_VIDE, ligneId: null })}>Annuler</button>}</span></label>
        </form>
        <div className="tbl-wrap"><table className="grid">
          <thead><tr><th>Intervalle</th><th>Horaires</th>{COLS.map((k) => <th key={k} className="num">{LIBELLES_CAISSE[k]}</th>)}<th className="num">Total espèces</th><th className="num">Chiffre d'aff.</th><th></th></tr></thead>
          <tbody>
            {(caisse?.lignes ?? []).map((l: any) => (
              <tr key={String(l._id)}>
                <td>{l.dateDebut} → {l.dateFin}</td><td>{l.horaires ?? "—"}</td>
                {COLS.map((k) => <td key={k} className="num">{l[k] ? num(l[k]) : "—"}</td>)}
                <td className="num"><b>{num(l.totalEspeces)}</b></td><td className="num"><b style={{ color: "var(--green)" }}>{num(l.chiffreAffaires)}</b></td>
                <td style={{ whiteSpace: "nowrap" }}><button className="btn" onClick={() => setFc({ ...l, ligneId: String(l._id) })}>Modifier</button> <button className={`btn ${confirmId === String(l._id) ? "primary" : ""}`} onClick={() => supprimer(String(l._id), false)} onBlur={() => setConfirmId(null)}>{confirmId === String(l._id) ? "Confirmer" : "Supprimer"}</button></td>
              </tr>
            ))}
            {caisse && caisse.lignes.length > 0 && <tr><td><b>TOTAL GÉNÉRAL</b></td><td></td>{COLS.map((k) => <td key={k} className="num"><b>{num(t[k] ?? 0)}</b></td>)}<td className="num"><b>{num(t.totalEspeces)}</b></td><td className="num"><b>{num(t.chiffreAffaires)}</b></td><td></td></tr>}
            {caisse && caisse.lignes.length === 0 && <tr><td colSpan={COLS.length + 5}>Aucune ligne pour ce mois.</td></tr>}
          </tbody>
        </table></div>
      </>)}

      {onglet !== "caisse" && onglet !== "graphes" && (<>
        <div className="cards">
          <div className="card"><div className="k">{LIBELLE_CATEGORIE[onglet]}</div><div className="v">{primes ? fcfa(primes.total) : "…"}</div></div>
          <div className="card"><div className="k">Médecins</div><div className="v">{primes ? primes.lignes.length : "…"}</div></div>
          <div className="card"><div className="k">Actes</div><div className="v">{primes ? primes.lignes.reduce((s: number, l: any) => s + (l.actes ?? 0), 0) : "…"}</div></div>
        </div>
        <form className="form" onSubmit={sauverPrime}>
          <label>Médecin<input value={fp.designation} onChange={(e) => setFp({ ...fp, designation: e.target.value })} placeholder="Dr. Nom Prénom" required /></label>
          <label>Date début<input type="date" value={fp.dateDebut ?? ""} onChange={(e) => setFp({ ...fp, dateDebut: e.target.value })} /></label>
          <label>Date fin<input type="date" value={fp.dateFin ?? ""} onChange={(e) => setFp({ ...fp, dateFin: e.target.value })} /></label>
          <label>Actes<input type="number" min={0} value={fp.actes} onChange={(e) => setFp({ ...fp, actes: e.target.value })} /></label>
          <label>Montant unitaire (FCFA)<input type="number" min={0} value={fp.montantUnitaire} onChange={(e) => setFp({ ...fp, montantUnitaire: e.target.value })} /></label>
          <label>Montant total<input value={fcfa(montantTotalPrime(Number(fp.actes), Number(fp.montantUnitaire)))} readOnly /></label>
          <label>Notes<input value={fp.notes ?? ""} onChange={(e) => setFp({ ...fp, notes: e.target.value })} placeholder="Remarques…" /></label>
          <label>&nbsp;<span style={{ display: "flex", gap: 6 }}><button className="btn primary" type="submit">{fp.primeId ? "Mettre à jour" : "Ajouter"}</button>{fp.primeId && <button type="button" className="btn" onClick={() => setFp({ ...PRIME_VIDE, primeId: null })}>Annuler</button>}</span></label>
        </form>
        <div className="tbl-wrap"><table className="grid">
          <thead><tr><th>Médecin</th><th>Date début</th><th>Date fin</th><th className="num">Actes</th><th className="num">Montant unit.</th><th className="num">Montant total</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {(primes?.lignes ?? []).map((l: any) => (
              <tr key={String(l._id)}><td><b>{l.designation}</b></td><td>{l.dateDebut ?? "—"}</td><td>{l.dateFin ?? "—"}</td><td className="num">{l.actes ?? 0}</td><td className="num">{num(l.montantUnitaire ?? 0)}</td><td className="num"><b>{num(l.montant)}</b></td><td>{l.notes ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}><button className="btn" onClick={() => setFp({ ...l, primeId: String(l._id), actes: l.actes ?? 0, montantUnitaire: l.montantUnitaire ?? 0 })}>Modifier</button> <button className={`btn ${confirmId === String(l._id) ? "primary" : ""}`} onClick={() => supprimer(String(l._id), true)} onBlur={() => setConfirmId(null)}>{confirmId === String(l._id) ? "Confirmer" : "Supprimer"}</button></td></tr>
            ))}
            {primes && primes.lignes.length > 0 && <tr><td><b>TOTAL GÉNÉRAL</b></td><td></td><td></td><td className="num"><b>{primes.lignes.reduce((s: number, l: any) => s + (l.actes ?? 0), 0)}</b></td><td></td><td className="num"><b>{num(primes.total)}</b></td><td></td><td></td></tr>}
            {primes && primes.lignes.length === 0 && <tr><td colSpan={8}>Aucune prime dans cette catégorie pour ce mois.</td></tr>}
          </tbody>
        </table></div>
      </>)}

      {onglet === "graphes" && graphes && (<>
        <h3>Chiffre d'affaires — 6 derniers mois</h3>
        <Barres data={graphes.caParMois.map((m: any) => ({ key: m.periode, label: `${libellePeriode(m.periode).slice(0, 3)} ${m.periode.slice(2, 4)}`, value: m.chiffreAffaires }))} format={fcfa} />
        <h3 style={{ marginTop: 26 }}>Primes par catégorie — {libellePeriode(periode)}</h3>
        <Barres data={graphes.primesParCategorie.map((c: any) => ({ key: c.categorie, label: LIBELLE_COURT[c.categorie] ?? c.libelle, value: c.montant }))} couleur="var(--violet, #6a4a9c)" format={fcfa} />
      </>)}
    </>
  );
}
