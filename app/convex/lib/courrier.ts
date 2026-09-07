// Rendu PUR du courrier de paie : lettre depuis un modèle + e-mail HTML (lettre + bulletin).
import type { BulletinPeriode } from "./calculBulletins";

export const MODELE_DEFAUT =
`Madame, Monsieur {nom},

Veuillez trouver ci-joint votre bulletin de paie pour la période de {periode}.
Le montant net qui vous est versé s'élève à {net}.

Nous vous remercions pour votre engagement au sein de {entreprise}.

La Direction`;

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
export const libellePeriode = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MOIS[(m ?? 1) - 1] ?? p} ${y ?? ""}`.trim();
};
export const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export function rendreLettre(modele: string, vars: { nom: string; periode: string; net: number; entreprise: string }): string {
  return modele
    .replaceAll("{nom}", vars.nom)
    .replaceAll("{periode}", libellePeriode(vars.periode))
    .replaceAll("{net}", fcfa(vars.net))
    .replaceAll("{entreprise}", vars.entreprise);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const num = (n: number) => Math.round(n).toLocaleString("fr-FR");

// E-mail HTML autonome (styles inline) : lettre + bulletin sous forme de tableaux.
export function htmlEmail(args: { lettre: string; bulletin: BulletinPeriode; periode: string; entreprise: { nom: string; adresse?: string; couleurEntete?: string } }): string {
  const { lettre, bulletin: b, periode, entreprise } = args;
  const couleur = entreprise.couleurEntete ?? "#0f2a44";
  const th = `style="background:#eef2ec;text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase"`;
  const td = `style="padding:5px 8px;border-bottom:1px solid #e5ebe2;font-size:12px"`;
  const tdn = `style="padding:5px 8px;border-bottom:1px solid #e5ebe2;font-size:12px;text-align:right"`;
  const gains = b.lignesGain.map((l) => `<tr><td ${td}>${l.code}</td><td ${td}>${esc(l.libelle)}</td><td ${tdn}>${num(l.gain)}</td></tr>`).join("");
  const cots = b.cotisations.filter((c) => c.retenue || c.chargePatronale).map((c) =>
    `<tr><td ${td}>${c.code}</td><td ${td}>${esc(c.libelle)}</td><td ${tdn}>${c.taux ? c.taux + "%" : ""}</td><td ${tdn}>${c.retenue ? num(c.retenue) : ""}</td><td ${tdn}>${c.chargePatronale ? num(c.chargePatronale) : ""}</td></tr>`).join("");

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#16222e;max-width:720px;margin:0 auto;padding:20px">
<div style="border-bottom:3px solid ${couleur};padding-bottom:10px;margin-bottom:16px">
  <div style="font-weight:800;color:${couleur};font-size:18px">${esc(entreprise.nom)}</div>
  <div style="font-size:12px;color:#48586a">${esc(entreprise.adresse ?? "")}</div>
</div>
<div style="white-space:pre-line;font-size:14px;line-height:1.6;margin-bottom:24px">${esc(lettre)}</div>
<h3 style="margin:0 0 8px;font-size:15px">Bulletin de paie — ${esc(libellePeriode(periode))}</h3>
<p style="font-size:12px;margin:0 0 10px">${esc(b.nom)} · Matricule ${esc(b.matricule)} · ${esc(b.fonction ?? "")} · Société ${b.societe}</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr><th ${th}>N°</th><th ${th}>Gains</th><th ${th} align="right">Montant</th></tr>${gains}
<tr><td ${td}></td><td ${td}><b>Total brut</b></td><td ${tdn}><b>${num(b.brut)}</b></td></tr></table>
<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr><th ${th}>N°</th><th ${th}>Cotisations</th><th ${th}>Taux</th><th ${th}>Retenue</th><th ${th}>Ch. patron.</th></tr>${cots}
<tr><td ${td}></td><td ${td}><b>Total retenues</b></td><td ${td}></td><td ${tdn}><b>${num(b.totalRetenues)}</b></td><td ${td}></td></tr></table>
<div style="background:${couleur};color:#fff;padding:12px 16px;border-radius:6px;font-weight:700;font-size:16px;display:flex;justify-content:space-between"><span>NET À PAYER</span><span>${fcfa(b.net)}</span></div>
<p style="font-size:10px;color:#75879a;margin-top:14px">Conservez ce bulletin sans limitation de durée.</p>
</body></html>`;
}
