import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { fcfa, messageErreur } from "../lib/format";

type Statut = "ouverte" | "en_cours" | "cloturee" | "rejetee";
type Priorite = "basse" | "moyenne" | "haute";
const STATUT: Record<string, { label: string; cls: string }> = { ouverte: { label: "Ouverte", cls: "warn" }, en_cours: { label: "En cours", cls: "" }, cloturee: { label: "Clôturée", cls: "" }, rejetee: { label: "Rejetée", cls: "lock" } };
const PRIO: Record<string, string> = { basse: "Priorité basse", moyenne: "Priorité moyenne", haute: "Priorité haute" };
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR");
const aujourdHui = () => new Date().toISOString().slice(0, 10);
type Ligne = { produit: string; quantite: number; prixUnitaire: number };

export function Interventions() {
  const me = useQuery(api.users.me);
  const [statut, setStatut] = useState<Statut | "">("");
  const [priorite, setPriorite] = useState<Priorite | "">("");
  const liste = useQuery(api.interventions.liste, { statut: statut || undefined, priorite: priorite || undefined });
  const [sel, setSel] = useState<string | null>(null);
  const detail = useQuery(api.interventions.detail, sel ? { interventionId: sel as any } : "skip");
  const creer = useMutation(api.interventions.creer);
  const genererUploadUrl = useMutation(api.interventions.genererUploadUrl);
  const ajouterPhoto = useMutation(api.interventions.ajouterPhoto);
  const changerStatut = useMutation(api.interventions.changerStatut);
  const commenter = useMutation(api.interventions.commenter);

  const [ouvrirForm, setOuvrirForm] = useState(false);
  const [f, setF] = useState({ titre: "", priorite: "moyenne" as Priorite, lieu: "", service: "", chefService: "", methode: "", dateDemande: aujourdHui(), demandeur: "", commentaireInitial: "" });
  const [lignes, setLignes] = useState<Ligne[]>([{ produit: "", quantite: 1, prixUnitaire: 0 }]);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [texte, setTexte] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const niveau = me?.niveau ?? 0;

  const upload = async (file: File) => {
    const url = await genererUploadUrl();
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    const { storageId } = await res.json();
    return storageId as string;
  };

  const onCreer = async (e: React.FormEvent) => {
    e.preventDefault(); setEnvoi(true);
    try {
      const photos: string[] = [];
      for (const file of fichiers) photos.push(await upload(file));
      const r = await creer({ ...f, lieu: f.lieu || undefined, service: f.service || undefined, chefService: f.chefService || undefined, methode: f.methode || undefined,
        demandeur: f.demandeur || (me?.nom ?? ""), commentaireInitial: f.commentaireInitial || undefined, photos: photos as any,
        lignes: lignes.filter((l) => l.produit.trim()).map((l) => ({ produit: l.produit, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })) });
      setMsg(`Intervention ${r.reference} créée (${photos.length} photo(s)). Statut : ouverte — en attente de validation.`);
      setOuvrirForm(false); setFichiers([]); setLignes([{ produit: "", quantite: 1, prixUnitaire: 0 }]); setF({ ...f, titre: "", commentaireInitial: "" }); setSel(r.id);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); } finally { setEnvoi(false); }
  };

  const transition = async (s: Statut) => {
    if (!sel) return;
    if (s === "rejetee" && confirm !== "rejet") { setConfirm("rejet"); return; }
    try { await changerStatut({ interventionId: sel as any, statut: s, commentaire: motif || undefined }); setMotif(""); setConfirm(null); setMsg(`Intervention ${STATUT[s].label.toLowerCase()}.`); }
    catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Interventions techniciens</h1>
      <p className="sub">Demandes de maintenance et de matériel avec photos, lignes chiffrées, validation par la direction et fil de commentaires.</p>
      <div className="bar">
        <select value={statut} onChange={(e) => setStatut(e.target.value as any)}><option value="">Tous les statuts</option>{Object.entries(STATUT).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
        <select value={priorite} onChange={(e) => setPriorite(e.target.value as any)}><option value="">Toutes priorités</option>{Object.entries(PRIO).map(([k, s]) => <option key={k} value={k}>{s}</option>)}</select>
        <span className="grow" />
        <button className="btn green" onClick={() => setOuvrirForm((o) => !o)}>{ouvrirForm ? "Fermer le formulaire" : "Nouvelle intervention"}</button>
      </div>
      {msg && <div className="note">{msg}</div>}

      {ouvrirForm && (
        <form className="form" style={{ gridTemplateColumns: "1fr" }} onSubmit={onCreer}>
          <div className="form" style={{ margin: 0, padding: 0, border: 0, background: "transparent" }}>
            <label>Titre *<input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} required placeholder="Ex : Maintenance bloc C" /></label>
            <label>Priorité<select value={f.priorite} onChange={(e) => setF({ ...f, priorite: e.target.value as Priorite })}>{Object.entries(PRIO).map(([k, s]) => <option key={k} value={k}>{s}</option>)}</select></label>
            <label>Date de demande<input type="date" value={f.dateDemande} onChange={(e) => setF({ ...f, dateDemande: e.target.value })} required /></label>
            <label>Demandeur<input value={f.demandeur} onChange={(e) => setF({ ...f, demandeur: e.target.value })} placeholder={me?.nom ?? ""} /></label>
            <label>Service<input value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} placeholder="Maintenance, Labo…" /></label>
            <label>Chef de service<input value={f.chefService} onChange={(e) => setF({ ...f, chefService: e.target.value })} /></label>
            <label>Lieu<input value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value })} placeholder="Salle serveurs, bloc C…" /></label>
            <label>Méthode de commande<input value={f.methode} onChange={(e) => setF({ ...f, methode: e.target.value })} placeholder="Email, téléphone, en personne…" /></label>
            <label>Photos / pièces jointes<input type="file" accept="image/*,.pdf" multiple onChange={(e) => setFichiers(Array.from(e.target.files ?? []))} /></label>
          </div>
          <div className="tbl-wrap">
            <table className="grid">
              <thead><tr><th>#</th><th>Produit / matériel</th><th className="num">Quantité</th><th className="num">Prix unitaire</th><th className="num">Total</th><th></th></tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}><td>{i + 1}</td>
                    <td><input style={{ width: 240, textAlign: "left" }} value={l.produit} onChange={(e) => setLignes((ls) => ls.map((x, j) => j === i ? { ...x, produit: e.target.value } : x))} placeholder="Nom du produit" /></td>
                    <td className="num"><input type="number" min={0} value={l.quantite} onChange={(e) => setLignes((ls) => ls.map((x, j) => j === i ? { ...x, quantite: Number(e.target.value) } : x))} /></td>
                    <td className="num"><input type="number" min={0} value={l.prixUnitaire} onChange={(e) => setLignes((ls) => ls.map((x, j) => j === i ? { ...x, prixUnitaire: Number(e.target.value) } : x))} /></td>
                    <td className="num">{fcfa(Number(l.quantite) * Number(l.prixUnitaire))}</td>
                    <td><button type="button" className="btn" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>×</button></td></tr>
                ))}
                <tr><td colSpan={4}><button type="button" className="btn" onClick={() => setLignes((ls) => [...ls, { produit: "", quantite: 1, prixUnitaire: 0 }])}>+ Ajouter une ligne</button></td>
                  <td className="num"><b>{fcfa(lignes.reduce((t, l) => t + Number(l.quantite) * Number(l.prixUnitaire), 0))}</b></td><td></td></tr>
              </tbody>
            </table>
          </div>
          <label>Commentaire initial<input value={f.commentaireInitial} onChange={(e) => setF({ ...f, commentaireInitial: e.target.value })} placeholder="Contexte, urgence…" /></label>
          <div><button className="btn primary" type="submit" disabled={envoi || !f.titre.trim()}>{envoi ? "Envoi…" : "Soumettre la demande"}</button></div>
        </form>
      )}

      <div className="tbl-wrap">
        <table className="grid">
          <thead><tr><th>Référence</th><th>Titre</th><th>Priorité</th><th>Lieu</th><th>Demandeur</th><th>Date</th><th className="num">Photos</th><th className="num">Total</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {(liste ?? []).map((i: any) => (
              <tr key={String(i._id)} style={{ background: sel === String(i._id) ? "var(--card-2)" : undefined }}>
                <td><b>{i.reference}</b></td><td>{i.titre}</td>
                <td><span className={`badge ${i.priorite === "haute" ? "lock" : i.priorite === "moyenne" ? "warn" : ""}`}>{PRIO[i.priorite]}</span></td>
                <td>{i.lieu ?? "—"}</td><td>{i.demandeur}</td><td>{fmtDate(i.dateDemande)}</td><td className="num">{i.nbPhotos}</td><td className="num">{fcfa(i.total)}</td>
                <td><span className={`badge ${STATUT[i.statut].cls}`}>{STATUT[i.statut].label}</span></td>
                <td><button className="btn" onClick={() => setSel(sel === String(i._id) ? null : String(i._id))}>{sel === String(i._id) ? "Masquer" : "Voir"}</button></td>
              </tr>
            ))}
            {liste && liste.length === 0 && <tr><td colSpan={10}>Aucune intervention.</td></tr>}
          </tbody>
        </table>
      </div>

      {sel && detail && (
        <div className="panel">
          <div className="bar"><h3 style={{ margin: 0 }}>{detail.reference} — {detail.titre}</h3><span className={`badge ${STATUT[detail.statut].cls}`}>{STATUT[detail.statut].label}</span><span className="badge warn">{PRIO[detail.priorite]}</span></div>
          <div className="meta-grid">
            <div><b>Demandeur</b> {detail.demandeur}</div><div><b>Service</b> {detail.service ?? "—"}</div><div><b>Chef de service</b> {detail.chefService ?? "—"}</div>
            <div><b>Méthode</b> {detail.methode ?? "—"}</div><div><b>Lieu</b> {detail.lieu ?? "—"}</div><div><b>Date</b> {fmtDate(detail.dateDemande)}</div>
            <div><b>Validation</b> {detail.validateur ? `${detail.validateur} · ${new Date(detail.valideLe!).toLocaleString("fr-FR")}` : "—"}</div>
          </div>
          {detail.commentaireInitial && <p><b>Commentaire initial :</b> {detail.commentaireInitial}</p>}

          <h4 className="feat-label">Photos ({detail.photosUrls.length})</h4>
          <div className="bar">
            {detail.photosUrls.map((u: string, i: number) => <a key={i} href={u} target="_blank" rel="noreferrer"><img className="thumb" src={u} alt={`photo ${i + 1}`} /></a>)}
            <label className="btn">Ajouter une photo<input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const id = await upload(file); await ajouterPhoto({ interventionId: sel as any, storageId: id as any }); setMsg("Photo ajoutée."); }} /></label>
          </div>

          {detail.lignes.length > 0 && (
            <div className="tbl-wrap"><table className="grid">
              <thead><tr><th>#</th><th>Produit</th><th className="num">Qté</th><th className="num">PU</th><th className="num">Total</th></tr></thead>
              <tbody>{detail.lignes.map((l: any, i: number) => <tr key={i}><td>{i + 1}</td><td>{l.produit}</td><td className="num">{l.quantite}</td><td className="num">{fcfa(l.prixUnitaire)}</td><td className="num">{fcfa(l.quantite * l.prixUnitaire)}</td></tr>)}
                <tr><td colSpan={4}><b>Total</b></td><td className="num"><b>{fcfa(detail.total)}</b></td></tr></tbody>
            </table></div>
          )}

          {(detail.statut === "ouverte" || detail.statut === "en_cours") && (
            <>
              <h4 className="feat-label">Validation de la demande</h4>
              <div className="bar">
                {niveau >= 5 ? (<>
                  <input placeholder="Commentaire / motif (obligatoire pour un rejet)" style={{ width: 360, textAlign: "left" }} value={motif} onChange={(e) => setMotif(e.target.value)} />
                  {detail.statut === "ouverte" && <button className="btn green" onClick={() => transition("en_cours")}>Valider (passer en cours)</button>}
                  {detail.statut === "en_cours" && <button className="btn green" onClick={() => transition("cloturee")}>Clôturer</button>}
                  <button className={`btn ${confirm === "rejet" ? "primary" : ""}`} disabled={confirm === "rejet" && !motif.trim()} onClick={() => transition("rejetee")} onBlur={() => setConfirm(null)}>{confirm === "rejet" ? "Confirmer le rejet" : "Rejeter"}</button>
                </>) : <span className="badge warn">Validation réservée à la direction (niveau 5+)</span>}
              </div>
            </>
          )}

          <h4 className="feat-label">Commentaires ({detail.commentaires.length})</h4>
          {detail.commentaires.length === 0 && <p style={{ color: "var(--ink-faint)" }}>Aucun commentaire pour le moment.</p>}
          {detail.commentaires.map((c: any, i: number) => <div key={i} className="comment"><b>{c.auteur}</b> <small>{new Date(c.date).toLocaleString("fr-FR")}</small><div>{c.texte}</div></div>)}
          <div className="bar"><input placeholder="Ajouter un commentaire…" style={{ width: 420, textAlign: "left" }} value={texte} onChange={(e) => setTexte(e.target.value)} />
            <button className="btn" disabled={!texte.trim()} onClick={async () => { await commenter({ interventionId: sel as any, texte }); setTexte(""); }}>Publier</button></div>
        </div>
      )}
    </>
  );
}
