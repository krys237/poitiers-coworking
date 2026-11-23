// `toLocaleString("fr-FR")` separe les milliers par une espace fine insecable
// (U+202F). Deux raisons de ne pas la garder :
//   - en colonne, elle est si etroite que « 285 000 » se lit « 285000 », ce qui
//     annule le benefice de l'alignement des chiffres ;
//   - elle n'est pas encodable en Latin-1, donc elle casse la generation des
//     PDF (cf. le `clean()` de convex/paiePdf.ts et la note de CLAUDE.md).
// On la remplace par une espace insecable ordinaire (U+00A0) : lisible, et
// encodable par les polices standard du PDF.
const espacerMilliers = (n: number) =>
  Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");

export const fcfa = (n: number) => `${espacerMilliers(n)} FCFA`;
export const num = (n: number) => espacerMilliers(n);

// Formalisme des chiffres (skill poitiers-ui-ux-system §3) :
//   - décimales à la virgule, jamais de zéro décimal inutile : « 2,5 % », « 4 % » ;
//   - l'unité est séparée par une espace insécable, elle ne se détache pas du nombre.
export const pct = (n: number, decimales = 1) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimales })} %`;
export const jours = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} j`;

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const libellePeriode = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return `${MOIS[(m ?? 1) - 1] ?? p} ${y ?? ""}`.trim();
};
export const periodeCourante = () => new Date().toISOString().slice(0, 7);

/**
 * Message lisible d'une erreur Convex.
 *
 * Deux familles d'erreurs arrivent ici, et il ne faut pas les traiter de la même façon.
 *
 * Les **erreurs métier** sont levées par nos propres `throw new Error("…")` : leur texte est déjà
 * écrit pour l'utilisateur, il suffit de le sortir de l'enveloppe technique.
 *
 * Les **erreurs de validation d'arguments** sont produites par Convex quand l'écran et la mutation
 * ne décrivent pas la même donnée. Leur texte est un dump structuré — nom du validateur, chemin
 * du champ, objet reçu en entier — totalement illisible, et qui plus est trompeur : l'utilisateur
 * croit avoir mal saisi alors que sa saisie est hors de cause. Constaté le 20/11/2026 en
 * production, où la modification d'une fiche employé échouait sur le champ `contrat`, accepté à la
 * création mais absent de la mutation de modification. On les traduit donc en une phrase qui dit
 * la seule chose utile : ce n'est pas votre saisie, et voici quoi signaler.
 */
export const messageErreur = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);

  // Champ envoyé que le serveur n'attend pas — le cas du 20/11.
  const extra = /extra field [`'"]?([A-Za-z0-9_.]+)[`'"]?/.exec(m);
  if (extra) {
    return `Le formulaire transmet un champ que le serveur n'accepte pas (« ${extra[1]} »). Votre saisie n'est pas en cause : signalez-le, c'est un défaut de l'application.`;
  }
  // Champ obligatoire absent.
  const manquant = /[Mm]issing (?:the )?required field [`'"]?([A-Za-z0-9_.]+)[`'"]?/.exec(m);
  if (manquant) {
    return `Un champ obligatoire n'a pas été transmis au serveur (« ${manquant[1]} »). Votre saisie n'est pas en cause : signalez-le, c'est un défaut de l'application.`;
  }
  // Type inattendu : le chemin du champ est la seule information exploitable du dump.
  if (/ArgumentValidationError|ValidationError/.test(m)) {
    const chemin = /Path: ([A-Za-z0-9_.[\]]+)/.exec(m);
    return chemin
      ? `Le serveur a refusé la valeur du champ « ${chemin[1]} » : elle n'est pas du type attendu. Signalez-le, c'est un défaut de l'application.`
      : "Le serveur a refusé les données envoyées par le formulaire. Votre saisie n'est pas en cause : signalez-le, c'est un défaut de l'application.";
  }

  // Erreur métier : son texte est déjà rédigé pour l'utilisateur.
  const u = /Uncaught (?:Convex)?Error: ([\s\S]*?)(?:\n|\s+at handler| Called by)/.exec(m) ?? /Uncaught (?:Convex)?Error: ([\s\S]*)/.exec(m);
  if (u) return u[1].trim();

  // Dernier recours : une erreur serveur sans message exploitable. Mieux vaut l'avouer et donner
  // l'identifiant de requête — c'est lui qui permet de la retrouver dans les journaux Convex.
  const requete = /Request ID: ([a-f0-9]+)/i.exec(m);
  if (/Server Error/i.test(m)) {
    return `Le serveur a rencontré une erreur.${requete ? ` Référence à communiquer : ${requete[1]}.` : ""}`;
  }
  return m.trim();
};
