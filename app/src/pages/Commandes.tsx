import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { parseCsvLignes, exportCsvLignes, totalLigne, totalCommande } from "../../convex/lib/commandes";
import { fcfa, messageErreur } from "../lib/format";

type Type = "medicale" | "fourniture";
type Ligne = { produit: string; dci?: string; quantite: number; prixUnitaire: number };
const STATUT: Record<string, { label: string; cls: string }> = {
  en_attente: { label: "En attente", cls: "warn" }, validee: { label: "Validée", cls: "" }, rejetee: { label: "Rejetée", cls: "lock" }, livree: { label: "Livrée", cls: "" },
};
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR");
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const LIGNE_VIDE: Ligne = { produit: "", dci: "", quantite: 1, prixUnitaire: 0 };

function telecharger(nom: string, contenu: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nom; a.click(); URL.revokeObjectURL(url);
}

export function Commandes() {
  const me = useQuery(api.users.me);
  const [type, setType] = useState<Type>("medicale");
  const liste = useQuery(api.commandes.liste, { type });
  const [sel, setSel] = useState<string | null>(null);
  const detail = useQuery(api.commandes.detail, sel ? { commandeId: sel as any } : "skip");
  const creer = useMutation(api.commandes.creer);
  const changerStatut = useMutation(api.commandes.changerStatut);
  const commenter = useMutation(api.commandes.commenter);

  const [ouvrirForm, setOuvrirForm] = useState(false);
  const [f, setF] = useState({ date: aujourdHui(), libelle: "", demandeur: "", service: "", commentaire: "" });
  const [lignes, setLignes] = useState<Ligne[]>([{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [texte, setTexte] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const niveau = me?.niveau ?? 0;
  const majLigne = (i: number, patch: Partial<Ligne>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const lignesValides = lignes.filter((l) => l.produit.trim());

  const onImport = async (file: File) => {
    const parsed = parseCsvLignes(await file.text());
    if (!parsed.length) { setMsg("Aucune ligne reconnue (colonnes : Nom du produit;DCI;Quantité;Prix unitaire)."); return; }
    setLignes(parsed); setOuvrirForm(true); setMsg(`${parsed.length} ligne(s) importée(s) du CSV — vérifiez puis enregistrez.`);
  };

  const onCreer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await creer({ type, date: f.date, libelle: f.libelle || undefined, demandeur: f.demandeur || (me?.nom ?? ""), service: f.service || undefined, commentaire: f.commentaire || undefined,
        lignes: lignesValides.map((l) => ({ produit: l.produit, dci: type === "medicale" && l.dci ? l.dci : undefined, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })) });
      setMsg(`Commande ${r.reference} créée — total ${fcfa(r.total)}. Statut : en attente de validation.`);
      setOuvrirForm(false); setLignes([{ ...LIGNE_VIDE }, { ...LIGNE_VIDE }, { ...LIGNE_VIDE }]); setF({ ...f, libelle: "", commentaire: "" }); setSel(r.id);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  const transition = async (statut: "validee" | "rejetee" | "livree") => {
    if (!sel) return;
    if (statut === "rejetee" && confirm !== "rejet") { setConfirm("rejet"); return; }
    try { await changerStatut({ commandeId: sel as any, statut, commentaire: motif || undefined }); setMotif(""); setConfirm(null); setMsg(`Commande ${STATUT[statut].label.toLowerCase()}.`); }
    catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Commandes</h1>
      <p className="sub">Médicaments (avec DCI) et fournitures : lignes de produits, import/export CSV, comparaison automatique avec la commande précédente, validation par la direction.</p>

      <div className="bar">
        <div className="tabs">
          <button className={`tab ${type === "medicale" ? "active" : ""}`} onClick={() => { setType("medicale"); setSel(null); }}>Médicaments (DCI)</button>
          <button className={`tab ${type === "fourniture" ? "active" : ""}`} onClick={() => { setType("fourniture"); setSel(null); }}>Fournitures</button>
        </div>
        <span className="grow" />
        <label className="btn">Importer CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} /></label>
        <button className="btn green" onClick={() => setOuvrirForm((o) => !o)}>{ouvrirForm ? "Fermer le formulaire" : "Nouvelle commande"}</button>
      </div>
      {msg && <div className="note">{msg}</div>}

      {ouvrirForm && (
        <form className="form" style={{ gridTemplateColumns: "1fr" }} onSubmit={onCreer}>
          <div className="form" style={{ margin: 0, padding: 0, border: 0, background: "transparent" }}>
            <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
            <label>Libellé<input value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} placeholder={type === "medicale" ? "Commande mensuelle" : "Fournitures de bureau"} /></label>
            <label>Demandeur<input value={f.demandeur} onChange={(e) => setF({ ...f, demandeur: e.target.value })} placeholder={me?.nom ?? ""} /></label>
            <label>Service<input value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} placeholder="Pharmacie, Accueil…" /></label>
          </div>
          <div className="tbl-wrap">
            <table className="grid">
              <thead><tr><th>#</th><th>Nom du produit</th>{type === "medicale" && <th>DCI</th>}<th className="num">Quantité</th><th className="num">Prix unitaire</th><th className="num">Prix total</th><th></th></tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input style={{ width: 220, textAlign: "left" }} value={l.produit} onChange={(e) => majLigne(i, { produit: e.target.value })} placeholder="Nom du produit" /></td>
                    {type === "medicale" && <td><input style={{ width: 150, textAlign: "left" }} value={l.dci ?? ""} onChange={(e) => majLigne(i, { dci: e.target.value })} placeholder="DCI" /></td>}
                    <td className="num"><input type="number" min={0} value={l.quantite} onChange={(e) => majLigne(i, { quantite: Number(e.target.value) })} /></td>
                    <td className="num"><input type="number" min={0} value={l.prixUnitaire} onChange={(e) => majLigne(i, { prixUnitaire: Number(e.target.value) })} /></td>
                    <td className="num">{fcfa(totalLigne({ ...l, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) }))}</td>
                    <td><button type="button" className="btn" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>×</button></td>
                  </tr>
                ))}
                <tr><td colSpan={type === "medicale" ? 5 : 4}><button type="button" className="btn" onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}>+ Ajouter une ligne</button></td>
                  <td className="num"><b>{fcfa(totalCommande(lignesValides.map((l) => ({ ...l, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) }))))}</b></td><td></td></tr>
              </tbody>
            </table>
          </div>
          <label>Commentaire (optionnel)<input value={f.commentaire} onChange={(e) => setF({ ...f, commentaire: e.target.value })} placeholder="Notes, remarques sur la commande…" /></label>
          <div><button className="btn primary" type="submit" disabled={!lignesValides.length}>Enregistrer la commande</button></div>
        </form>
      )}

      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Référence</th><th>Date</th><th>Libellé</th><th>Demandeur</th><th>Service</th><th className="num">Lignes</th><th className="num">Total</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {(liste ?? []).map((c: any) => (
              <tr key={String(c._id)} style={{ background: sel === String(c._id) ? "var(--card-2)" : undefined }}>
                <td><b>{c.reference}</b></td><td>{fmtDate(c.date)}</td><td>{c.libelle ?? "—"}</td><td>{c.demandeur}</td><td>{c.service ?? "—"}</td>
                <td className="num">{c.nbLignes}</td><td className="num"><b>{fcfa(c.total)}</b></td>
                <td><span className={`badge ${STATUT[c.statut].cls}`}>{STATUT[c.statut].label}</span></td>
                <td><button className="btn" onClick={() => setSel(sel === String(c._id) ? null : String(c._id))}>{sel === String(c._id) ? "Masquer" : "Voir"}</button></td>
              </tr>
            ))}
            {liste && liste.length === 0 && <tr><td colSpan={9}>Aucune commande de ce type.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && detail && (
        <div className="panel">
          <div className="bar">
            <h3 style={{ margin: 0 }}>{detail.reference} — {detail.libelle ?? (detail.type === "medicale" ? "Commande de médicaments" : "Commande de fournitures")}</h3>
            <span className={`badge ${STATUT[detail.statut].cls}`}>{STATUT[detail.statut].label}</span>
            <span className="grow" />
            <button className="btn" onClick={() => telecharger(`${detail.reference}.csv`, exportCsvLignes(detail.lignes))}>Télécharger CSV</button>
          </div>
          <div className="meta-grid">
            <div><b>Date</b> {fmtDate(detail.date)}</div><div><b>Demandeur</b> {detail.demandeur}</div><div><b>Service</b> {detail.service ?? "—"}</div>
            <div><b>Validation</b> {detail.validateur ? `${detail.validateur} · ${new Date(detail.valideLe!).toLocaleString("fr-FR")}` : "—"}</div>
          </div>
          <div className="tbl-wrap">
            <table className="grid">
              <thead><tr><th>#</th><th>Produit</th>{detail.type === "medicale" && <th>DCI</th>}<th className="num">Qté</th><th className="num">PU</th><th className="num">Total</th></tr></thead>
              <tbody>
                {detail.lignes.map((l: any, i: number) => (
                  <tr key={i}><td>{i + 1}</td><td>{l.produit}</td>{detail.type === "medicale" && <td>{l.dci ?? "—"}</td>}<td className="num">{l.quantite}</td><td className="num">{fcfa(l.prixUnitaire)}</td><td className="num">{fcfa(totalLigne(l))}</td></tr>
                ))}
                <tr><td colSpan={detail.type === "medicale" ? 5 : 4}><b>Total général</b></td><td className="num"><b>{fcfa(detail.total)}</b></td></tr>
              </tbody>
            </table>
          </div>

          <h4 className="feat-label">Comparaison avec la commande précédente</h4>
          {detail.comparaison ? (
            <div className="compare">
              <div className="note" style={{ margin: 0 }}>
                Par rapport à <b>{detail.precedente!.reference}</b> ({fmtDate(detail.precedente!.date)}, {fcfa(detail.precedente!.total)}) :
                total <b>{detail.comparaison.variation >= 0 ? "+" : ""}{fcfa(detail.comparaison.variation)}</b>
                {detail.comparaison.variationPct != null && <> ({detail.comparaison.variationPct >= 0 ? "+" : ""}{detail.comparaison.variationPct} %)</>} · {detail.comparaison.inchanges} produit(s) inchangé(s)
              </div>
              <div className="cards" style={{ marginTop: 10 }}>
                <div className="card"><div className="k">Ajoutés ({detail.comparaison.ajoutes.length})</div><div style={{ fontSize: 13 }}>{detail.comparaison.ajoutes.map((l: any) => <div key={l.produit}>+ {l.produit} × {l.quantite}</div>)}{!detail.comparaison.ajoutes.length && "—"}</div></div>
                <div className="card"><div className="k">Retirés ({detail.comparaison.retires.length})</div><div style={{ fontSize: 13 }}>{detail.comparaison.retires.map((l: any) => <div key={l.produit}>− {l.produit} × {l.quantite}</div>)}{!detail.comparaison.retires.length && "—"}</div></div>
                <div className="card"><div className="k">Modifiés ({detail.comparaison.modifies.length})</div><div style={{ fontSize: 13 }}>{detail.comparaison.modifies.map((m: any) => <div key={m.produit}>{m.produit} : {m.avant.quantite} × {fcfa(m.avant.prixUnitaire)} → <b>{m.apres.quantite} × {fcfa(m.apres.prixUnitaire)}</b></div>)}{!detail.comparaison.modifies.length && "—"}</div></div>
              </div>
            </div>
          ) : <p style={{ color: "var(--ink-faint)" }}>Première commande de ce type : pas de comparaison possible.</p>}

          {(detail.statut === "en_attente" || detail.statut === "validee") && (
            <>
              <h4 className="feat-label">Validation</h4>
              <div className="bar">
                {detail.statut === "en_attente" && niveau >= 5 && (<>
                  <input placeholder="Commentaire / motif (obligatoire pour un rejet)" style={{ width: 360, textAlign: "left" }} value={motif} onChange={(e) => setMotif(e.target.value)} />
                  <button className="btn green" onClick={() => transition("validee")}>Valider</button>
                  <button className={`btn ${confirm === "rejet" ? "primary" : ""}`} disabled={confirm === "rejet" && !motif.trim()} onClick={() => transition("rejetee")} onBlur={() => setConfirm(null)}>{confirm === "rejet" ? "Confirmer le rejet" : "Rejeter"}</button>
                </>)}
                {detail.statut === "en_attente" && niveau < 5 && <span className="badge warn">En attente de validation par la direction (niveau 5+)</span>}
                {detail.statut === "validee" && <button className="btn primary" onClick={() => transition("livree")}>Marquer comme livrée</button>}
              </div>
            </>
          )}

          <h4 className="feat-label">Commentaires ({detail.commentaires.length})</h4>
          {detail.commentaires.map((c: any, i: number) => <div key={i} className="comment"><b>{c.auteur}</b> <small>{new Date(c.date).toLocaleString("fr-FR")}</small><div>{c.texte}</div></div>)}
          <div className="bar"><input placeholder="Ajouter un commentaire…" style={{ width: 420, textAlign: "left" }} value={texte} onChange={(e) => setTexte(e.target.value)} />
            <button className="btn" disabled={!texte.trim()} onClick={async () => { await commenter({ commandeId: sel as any, texte }); setTexte(""); }}>Publier</button></div>
        </div>
      )}
    </>
  );
}
