import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { messageErreur } from "../lib/format";
import { LIBELLE, NIVEAU, Role } from "../../convex/rbac";

const ROLES = Object.keys(LIBELLE) as Role[];
const SOCIETES = ["", "SESAME", "SOFINA", "SGC"];
const ORIGINE: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente de rattachement", cls: "warn" }, demo: { label: "Démo", cls: "" }, dev: { label: "Dev", cls: "lock" }, oidc: { label: "Connecté (OIDC)", cls: "" },
};
const FORM_VIDE = { email: "", nom: "", role: "employe" as Role, poste: "", departement: "", societe: "" };

export function Membres() {
  const membres = useQuery(api.users.liste);
  const me = useQuery(api.users.me);
  const modifier = useMutation(api.users.modifier);
  const creer = useMutation(api.users.creer);
  const [q, setQ] = useState("");
  const [f, setF] = useState(FORM_VIDE);
  const [edit, setEdit] = useState<Record<string, any>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const liste = (membres ?? []).filter((m: any) => `${m.nom ?? ""} ${m.email} ${m.poste ?? ""} ${m.departement ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const val = (m: any, k: string) => (edit[m._id]?.[k] ?? m[k] ?? "");

  const sauver = async (m: any) => {
    const e = edit[m._id] ?? {};
    try {
      await modifier({ userId: m._id, role: e.role, nom: e.nom, poste: e.poste, departement: e.departement, societe: e.societe === "" ? undefined : e.societe, codeAcces: e.codeAcces, isActive: e.isActive });
      setEdit((x) => { const n = { ...x }; delete n[m._id]; return n; }); setMsg(`Membre « ${m.nom ?? m.email} » mis à jour.`);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };
  const onCreer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await creer({ email: f.email, nom: f.nom || undefined, role: f.role, poste: f.poste || undefined, departement: f.departement || undefined, societe: (f.societe || undefined) as any });
      setMsg(`Membre ${f.email} créé — il sera rattaché à son identité lors de sa première connexion.`); setF(FORM_VIDE);
    } catch (err) { setMsg(`Erreur : ${messageErreur(err)}`); }
  };

  return (
    <>
      <h1>Gestion des membres</h1>
      <p className="sub">Attribuer les rôles et niveaux d'accès, activer ou désactiver les comptes, pré-provisionner un membre par e-mail.</p>
      {msg && <div className="note">{msg}</div>}

      <form className="form" onSubmit={onCreer}>
        <label>E-mail<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required placeholder="prenom.nom@domaine.com" /></label>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></label>
        <label>Rôle<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{LIBELLE[r]} {NIVEAU[r] ? `(niv. ${NIVEAU[r]})` : ""}</option>)}</select></label>
        <label>Poste<input value={f.poste} onChange={(e) => setF({ ...f, poste: e.target.value })} /></label>
        <label>Département<input value={f.departement} onChange={(e) => setF({ ...f, departement: e.target.value })} /></label>
        <label>Société<select value={f.societe} onChange={(e) => setF({ ...f, societe: e.target.value })}>{SOCIETES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
        <label>&nbsp;<button className="btn green" type="submit" disabled={!f.email}>Créer le membre</button></label>
      </form>

      <div className="bar"><input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="grow" /><span>{liste.length} membre(s)</span></div>

      <div className="tbl-wrap"><table className="grid">
        <thead><tr><th>Membre</th><th>Rôle / niveau</th><th>Poste · Département</th><th>Société</th><th>Origine</th><th>État</th><th></th></tr></thead>
        <tbody>{liste.map((m: any) => {
          const o = ORIGINE[m.origine] ?? ORIGINE.oidc; const enEdition = ouvert === m._id; const modifie = !!edit[m._id];
          return [
            <tr key={m._id}>
              <td><b>{m.nom ?? "—"}</b>{me && me._id === m._id && <span className="badge" style={{ marginLeft: 6 }}>vous</span>}<br /><small style={{ color: "var(--ink-faint)" }}>{m.email}</small></td>
              <td>{m.roleLibelle}{m.niveau ? <small style={{ color: "var(--ink-faint)" }}> · niv. {m.niveau}</small> : <small style={{ color: "var(--ink-faint)" }}> · spécial</small>}</td>
              <td>{m.poste ?? "—"}{m.departement ? ` · ${m.departement}` : ""}</td>
              <td>{m.societe ?? "—"}</td>
              <td><span className={`badge ${o.cls}`}>{o.label}</span></td>
              <td>{m.isActive ? "Actif" : <span className="badge lock">Inactif</span>}</td>
              <td><button className="btn" onClick={() => setOuvert(enEdition ? null : m._id)}>{enEdition ? "Fermer" : "Modifier"}</button></td>
            </tr>,
            enEdition && <tr key={m._id + "-edit"}><td colSpan={7} style={{ background: "var(--card-2)" }}>
              <div className="form" style={{ marginBottom: 0 }}>
                <label>Nom<input value={val(m, "nom")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], nom: e.target.value } })} /></label>
                <label>Rôle<select value={val(m, "role")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], role: e.target.value } })}>{ROLES.map((r) => <option key={r} value={r}>{LIBELLE[r]}</option>)}</select></label>
                <label>Poste<input value={val(m, "poste")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], poste: e.target.value } })} /></label>
                <label>Département<input value={val(m, "departement")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], departement: e.target.value } })} /></label>
                <label>Société<select value={val(m, "societe")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], societe: e.target.value } })}>{SOCIETES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}</select></label>
                <label>Code d'accès personnel<input type="password" value={val(m, "codeAcces")} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], codeAcces: e.target.value } })} placeholder="laisser vide = pas de code" /></label>
                <label>Compte actif<select value={String(edit[m._id]?.isActive ?? m.isActive)} onChange={(e) => setEdit({ ...edit, [m._id]: { ...edit[m._id], isActive: e.target.value === "true" } })}><option value="true">Oui</option><option value="false">Non</option></select></label>
                <label>&nbsp;<button className="btn primary" disabled={!modifie} onClick={() => sauver(m)}>Enregistrer</button></label>
              </div>
            </td></tr>,
          ];
        })}</tbody>
      </table></div>
    </>
  );
}
