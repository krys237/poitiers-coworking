import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseCsv, toFcfa } from "../lib/csv";
import { fcfa } from "../lib/format";

type Societe = "SESAME" | "SOFINA" | "SGC";
const SOCIETES: Societe[] = ["SESAME", "SOFINA", "SGC"];
const FORM_VIDE = { matricule: "", nom: "", fonction: "", societe: "SGC" as Societe, salaireBrut: "", dateDebut: "", congesInitial: "" };

export function Employes() {
  const employes = useQuery(api.employes.liste, {});
  const creer = useMutation(api.employes.creer);
  const modifier = useMutation(api.employes.modifier);
  const importer = useMutation(api.employes.importer);
  const [f, setF] = useState(FORM_VIDE);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const onImport = async (file: File) => {
    const rows = parseCsv(await file.text());
    const lignes = rows
      .map((r) => ({
        matricule: r.matricule ?? "", nom: r.nom ?? r["nom_et_prénoms"] ?? r.noms ?? "",
        fonction: r.fonction || undefined, adresse: r.adresse || undefined,
        cnps: r.cnps || undefined, niu: r.niu || undefined, email: r.email || undefined,
        societe: (SOCIETES.includes((r.societe ?? "").toUpperCase() as Societe) ? r.societe.toUpperCase() : "SGC") as Societe,
        salaireBrut: toFcfa(r.salaire_brut ?? r.salairebrut ?? r.brut ?? "0"),
        dateDebut: /^\d{4}-\d{2}-\d{2}$/.test(r.date_debut ?? "") ? r.date_debut : undefined,
      }))
      .filter((l) => l.matricule && l.nom);
    if (!lignes.length) { setMsg("Aucune ligne valide (colonnes attendues : matricule; nom; fonction; societe; salaire_brut; date_debut; email)."); return; }
    const r = await importer({ lignes });
    setMsg(`Import terminé : ${r.crees} créé(s), ${r.majs} mis à jour. Les bulletins sont recalculés automatiquement.`);
  };

  const liste = (employes ?? []).filter((e: any) => (e.nom + e.matricule + (e.fonction ?? "")).toLowerCase().includes(q.toLowerCase()));
  const sansDate = (employes ?? []).filter((e: any) => e.actif && !e.dateDebut).length;

  return (
    <>
      <h1>Employés</h1>
      <p className="sub">Fiches, fonctions, société de rattachement, date d'embauche (base de l'acquisition des congés). Tout est repris automatiquement dans la paie.</p>

      <div className="bar">
        <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        {sansDate > 0 && <span className="badge warn">{sansDate} fiche(s) sans date d'embauche</span>}
        <span className="grow" />
        <label className="btn">
          Importer CSV / Excel (CSV)
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </label>
      </div>
      {msg && <div className="note">{msg}</div>}

      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        if (!f.matricule || !f.nom) return;
        await creer({
          matricule: f.matricule, nom: f.nom, fonction: f.fonction || undefined, societe: f.societe, salaireBrut: toFcfa(f.salaireBrut),
          dateDebut: f.dateDebut || undefined, congesInitial: f.congesInitial ? Number(f.congesInitial) : undefined,
        });
        setF(FORM_VIDE);
      }}>
        <label>Matricule<input value={f.matricule} onChange={(e) => setF({ ...f, matricule: e.target.value })} required /></label>
        <label>Nom et prénoms<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required /></label>
        <label>Fonction<input value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })} /></label>
        <label>Société<select value={f.societe} onChange={(e) => setF({ ...f, societe: e.target.value as Societe })}>{SOCIETES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Salaire brut (FCFA)<input value={f.salaireBrut} onChange={(e) => setF({ ...f, salaireBrut: e.target.value })} inputMode="numeric" /></label>
        <label>Date d'embauche<input type="date" value={f.dateDebut} onChange={(e) => setF({ ...f, dateDebut: e.target.value })} /></label>
        <label>Solde congés initial (j)<input type="number" step="0.5" min="0" value={f.congesInitial} onChange={(e) => setF({ ...f, congesInitial: e.target.value })} placeholder="0" /></label>
        <label>&nbsp;<button className="btn primary" type="submit">Ajouter</button></label>
      </form>

      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Matricule</th><th>Nom et prénoms</th><th>Fonction</th><th>Société</th><th className="num">Salaire brut</th><th>Date d'embauche</th><th>État</th></tr></thead>
          <tbody>
            {liste.map((e: any) => (
              <tr key={e._id}>
                <td>{e.matricule}</td><td><b>{e.nom}</b></td><td>{e.fonction ?? "—"}</td>
                <td><span className="badge">{e.societe}</span></td>
                <td className="num">{fcfa(e.salaireBrut)}</td>
                <td>
                  <input type="date" value={e.dateDebut ?? ""} style={{ width: 150, textAlign: "left", borderColor: e.dateDebut ? undefined : "var(--amber)" }}
                    onChange={(ev) => ev.target.value && modifier({ employeId: e._id, dateDebut: ev.target.value })} />
                </td>
                <td>{e.actif ? "Actif" : <span className="badge warn">Inactif</span>}</td>
              </tr>
            ))}
            {employes && liste.length === 0 && <tr><td colSpan={7}>Aucun employé.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
