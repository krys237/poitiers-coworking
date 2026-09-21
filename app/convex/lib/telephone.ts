// Numéros de téléphone (logique PURE, partagée client / serveur).
//
// Consigne du 21/09/2026 (journal des décisions) : partout où l'on saisit un numéro de
// téléphone, l'indicatif du pays est OBLIGATOIRE. Un numéro est stocké au format
// international compact « +2376XXXXXXXX » ; l'affichage regroupe les chiffres.

export const INDICATIF_DEFAUT = "+237"; // Cameroun — proposé, jamais imposé

/** Chiffres et « + » seulement ; « 00 » international devient « + ». */
export function normaliserTelephone(brut: string | null | undefined): string | null {
  if (!brut) return null;
  let s = brut.replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

/** Message d'erreur à afficher si le numéro n'est pas au format attendu, sinon null. */
export function erreurTelephone(brut: string | null | undefined): string | null {
  if (!brut || !brut.trim()) return null;
  const s = brut.replace(/[\s.\-()]/g, "");
  if (!s.startsWith("+") && !s.startsWith("00")) return `Indiquez l'indicatif du pays : ${INDICATIF_DEFAUT} 6 90 00 00 00.`;
  if (!normaliserTelephone(brut)) return "Numéro invalide : indicatif suivi de 8 à 14 chiffres.";
  return null;
}

/** Un identifiant de connexion ressemble-t-il à un numéro (et non à un e-mail) ? */
export const ressembleAUnTelephone = (s: string) => /^[\s+0-9.\-()]+$/.test(s.trim()) && /\d{6,}/.test(s);

/** Affichage : « +237 6 90 00 00 00 ». */
export function formaterTelephone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+(\d{1,3})(\d+)$/.exec(e164);
  if (!m) return e164;
  const [, ind, reste] = m;
  const groupes = reste.length % 2 === 1 ? [reste[0], ...(reste.slice(1).match(/\d{2}/g) ?? [])] : (reste.match(/\d{2}/g) ?? [reste]);
  return `+${ind} ${groupes.join(" ")}`;
}

// Indicatifs proposés dans le sélecteur (le Cameroun d'abord, pré-rempli). Liste courte et
// volontaire : ceux que la clinique rencontre ; un numéro d'un autre pays se saisit avec « Autre ».
export const INDICATIFS: { code: string; pays: string; indicatif: string }[] = [
  { code: "CM", pays: "Cameroun", indicatif: "237" },
  { code: "FR", pays: "France", indicatif: "33" },
  { code: "GA", pays: "Gabon", indicatif: "241" },
  { code: "TD", pays: "Tchad", indicatif: "235" },
  { code: "CF", pays: "Centrafrique", indicatif: "236" },
  { code: "CG", pays: "Congo", indicatif: "242" },
  { code: "CD", pays: "RD Congo", indicatif: "243" },
  { code: "GQ", pays: "Guinée équatoriale", indicatif: "240" },
  { code: "NG", pays: "Nigeria", indicatif: "234" },
  { code: "CI", pays: "Côte d'Ivoire", indicatif: "225" },
  { code: "SN", pays: "Sénégal", indicatif: "221" },
  { code: "BE", pays: "Belgique", indicatif: "32" },
  { code: "US", pays: "États-Unis / Canada", indicatif: "1" },
];

/** Sépare un numéro stocké en indicatif (le plus long qui correspond) et partie nationale. */
export function separerTelephone(e164: string | null | undefined): { indicatif: string; national: string } {
  const s = (e164 ?? "").replace(/[\s.\-()]/g, "");
  if (!s.startsWith("+")) return { indicatif: INDICATIF_DEFAUT.slice(1), national: s.replace(/\D/g, "") };
  const chiffres = s.slice(1);
  const connu = [...INDICATIFS].map((i) => i.indicatif).sort((a, b) => b.length - a.length).find((i) => chiffres.startsWith(i));
  const ind = connu ?? chiffres.slice(0, 3);
  return { indicatif: ind, national: chiffres.slice(ind.length) };
}

/** Recompose « +<indicatif><national> » ; null si l'ensemble n'est pas un numéro valide. */
export const composerTelephone = (indicatif: string, national: string) => normaliserTelephone(`+${indicatif.replace(/\D/g, "")}${national}`);
