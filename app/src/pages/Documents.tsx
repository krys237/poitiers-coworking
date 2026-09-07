import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { messageErreur } from "../lib/format";

const NIVEAUX = [[1, "Tous (niv. 1)"], [2, "Chef d'équipe+"], [3, "Comptable+"], [4, "RH+"], [5, "Direction (DA1+)"], [6, "DA2+"], [7, "DG seul"]] as const;
const CATEGORIES = ["Factures", "Contrats", "Paie", "Procédures", "Rapports", "Devis", "Comptes rendus", "Administratif", "Divers"];
const ko = (n: number) => `${Math.max(1, Math.round(n / 1024))} Ko`;

type Form = { fichierId: string | null; nomFichier: string; taille: number; typeMime: string; titre: string; description: string; categorie: string; niveauVisible: number; niveauTelechargement: number; confidentiel: boolean; codeAcces: string; mode: "ia" | "heuristique" | "manuel"; detail?: string };
const FORM_VIDE: Form = { fichierId: null, nomFichier: "", taille: 0, typeMime: "", titre: "", description: "", categorie: "Divers", niveauVisible: 1, niveauTelechargement: 2, confidentiel: false, codeAcces: "", mode: "manuel" };

export function Documents() {
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("");
  const liste = useQuery(api.documents.liste, { recherche: recherche || undefined, categorie: categorie || undefined });
  const genererUploadUrl = useMutation(api.documents.genererUploadUrl);
  const deposer = useMutation(api.documents.deposer);
  const obtenirUrl = useMutation(api.documents.obtenirUrl);
  const supprimer = useMutation(api.documents.supprimer);
  const extraire = useAction(api.documentsIa.extraireMetadonnees);

  const [f, setF] = useState<Form>(FORM_VIDE);
  const [analyse, setAnalyse] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [demandeCode, setDemandeCode] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const monNiveau = liste?.monNiveau ?? 1;

  const choisirFichier = async (file: File) => {
    setAnalyse(true); setMsg(null);
    try {
      const url = await genererUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      const { storageId } = await res.json();
      const meta = await extraire({ fichierId: storageId, nomFichier: file.name, typeMime: file.type || "application/octet-stream" });
      setF({ ...FORM_VIDE, fichierId: storageId, nomFichier: file.name, taille: file.size, typeMime: file.type || "application/octet-stream",
        titre: meta.titre, description: meta.description, categorie: meta.categorie, mode: meta.mode, detail: meta.detail });
    } catch (e) { setMsg(`Erreur : ${messageErreur(e)}`); }
    finally { setAnalyse(false); }
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.fichierId || !f.titre.trim()) return;
    try {
      await deposer({
        fichierId: f.fichierId as any, nomFichier: f.nomFichier, taille: f.taille, typeMime: f.typeMime,
        titre: f.titre, description: f.description || undefined, categorie: f.categorie || undefined,
        niveauVisible: f.niveauVisible, niveauTelechargement: f.niveauTelechargement, confidentiel: f.confidentiel,
        codeAcces: f.codeAcces || undefined, modeMeta: f.mode,
      });
      setMsg(`« ${f.titre.trim()} » déposé.`); setF(FORM_VIDE);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  const telecharger = async (d: any) => {
    const id = String(d._id);
    if (d.codeRequis && demandeCode !== id) { setDemandeCode(id); return; }
    try {
      const r = await obtenirUrl({ documentId: d._id, code: codes[id] });
      setErreurs((m) => ({ ...m, [id]: "" })); setDemandeCode(null);
      window.open(r.url, "_blank", "noopener");
    } catch (err) { setErreurs((m) => ({ ...m, [id]: messageErreur(err) })); }
  };

  const onSupprimer = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    try { await supprimer({ documentId: id as any }); setMsg("Document supprimé."); } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
    setConfirmId(null);
  };

  return (
    <>
      <h1>Documents</h1>
      <p className="sub">Espace documentaire sécurisé — l'IA (ou un repli heuristique) pré-remplit titre, description et catégorie au dépôt ; chaque document porte son propre niveau d'accès.</p>

      <form className="form" onSubmit={enregistrer}>
        <label style={{ gridColumn: "1 / -1" }}>Fichier {analyse && <span className="badge warn">Analyse en cours…</span>}
          <input type="file" disabled={analyse} onChange={(e) => e.target.files?.[0] && choisirFichier(e.target.files[0])} />
          {f.fichierId && <small style={{ color: "var(--ink-faint)" }}>{f.nomFichier} · {ko(f.taille)} · métadonnées : <span className={`badge ${f.mode === "ia" ? "" : "warn"}`}>{f.mode === "ia" ? "IA" : f.mode === "heuristique" ? "heuristique" : "manuel"}</span>{f.detail ? ` — ${f.detail}` : ""}</small>}
        </label>
        <label>Titre *<input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} required disabled={!f.fichierId} /></label>
        <label>Description<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} disabled={!f.fichierId} /></label>
        <label>Catégorie<input list="cats" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} disabled={!f.fichierId} /><datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label>Visible à partir de<select value={f.niveauVisible} onChange={(e) => setF({ ...f, niveauVisible: +e.target.value })} disabled={!f.fichierId}>{NIVEAUX.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></label>
        <label>Téléchargeable à partir de<select value={f.niveauTelechargement} onChange={(e) => setF({ ...f, niveauTelechargement: +e.target.value })} disabled={!f.fichierId}>{NIVEAUX.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></label>
        <label>Code d'accès (optionnel)<input type="password" value={f.codeAcces} onChange={(e) => setF({ ...f, codeAcces: e.target.value })} placeholder="Laisser vide = pas de code" disabled={!f.fichierId} /></label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8, display: "flex" }}>
          <input type="checkbox" checked={f.confidentiel} disabled={!f.fichierId || monNiveau < 5} onChange={(e) => setF({ ...f, confidentiel: e.target.checked })} /> Confidentiel (DA1/DA2/DG uniquement){monNiveau < 5 && <small style={{ color: "var(--ink-faint)" }}> — réservé à la direction</small>}
        </label>
        <label>&nbsp;<button className="btn primary" type="submit" disabled={!f.fichierId || !f.titre.trim() || analyse}>Déposer</button></label>
      </form>
      {msg && <div className="note">{msg}</div>}

      <div className="bar">
        <input placeholder="Rechercher un document…" value={recherche} onChange={(e) => setRecherche(e.target.value)} style={{ minWidth: 260 }} />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          <option value="">Toutes catégories</option>
          {(liste?.categories ?? []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="grow" />
        <span>{liste ? `${liste.documents.length} document(s) visibles (niveau ${monNiveau})` : "…"}</span>
      </div>

      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {(liste?.documents ?? []).map((d: any) => {
          const id = String(d._id);
          return (
            <div className="card" key={id}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <span className="badge">{d.categorie}</span>
                {d.confidentiel && <span className="badge lock">Confidentiel</span>}
                {d.codeRequis && <span className="badge warn">Code requis</span>}
                <span className="badge" style={{ background: "var(--card-2)", color: "var(--ink-soft)" }}>voir niv. {d.niveauVisible}+ · télécharger niv. {d.niveauTelechargement}+</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.titre}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 8px" }}>{d.description ?? "—"}</div>
              <small style={{ color: "var(--ink-faint)" }}>{d.nomFichier} · {ko(d.taille)} · {new Date(d.deposeLe).toLocaleDateString("fr-FR")} · {d.deposePar} · méta {d.modeMeta}</small>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                {d.telechargeable ? (
                  <>
                    {d.codeRequis && demandeCode === id && (
                      <input type="password" placeholder="Code d'accès" style={{ width: 130 }} value={codes[id] ?? ""} onChange={(e) => setCodes((c) => ({ ...c, [id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && telecharger(d)} autoFocus />
                    )}
                    <button className="btn primary" onClick={() => telecharger(d)}>{d.codeRequis && demandeCode !== id ? "Télécharger (code)" : "Télécharger"}</button>
                  </>
                ) : <span className="badge warn">Lecture seule pour votre niveau</span>}
                <button className={`btn ${confirmId === id ? "primary" : ""}`} onClick={() => onSupprimer(id)} onBlur={() => setConfirmId(null)}>{confirmId === id ? "Confirmer la suppression" : "Supprimer"}</button>
              </div>
              {erreurs[id] && <div className="err" style={{ fontSize: 12, marginTop: 6 }}>{erreurs[id]}</div>}
            </div>
          );
        })}
        {liste && liste.documents.length === 0 && <div className="card">Aucun document visible.</div>}
      </div>
    </>
  );
}
