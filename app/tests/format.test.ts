// Traduction des erreurs Convex en français lisible : `npm run test:format`.
//
// Le 20/11/2026, la modification d'une fiche employé échouait en production et l'utilisateur ne
// voyait qu'un dump de validateur Convex. Ce qui est verrouillé ici, c'est que chaque famille
// d'erreur produise une phrase utile — et surtout qu'un défaut d'application ne soit jamais
// présenté comme une faute de saisie.
import { messageErreur } from "../src/lib/format.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => { if (cond) console.log("  ok  " + nom); else { console.error("  KO  " + nom, d ?? ""); echecs++; } };

// --- Champ en trop : le cas qui a cassé la production ---
const champEnTrop = new Error(
  `[CONVEX M(employes:modifier)] [Request ID: 8f3a2b1c] Server Error
ArgumentValidationError: Object contains extra field \`contrat\` that is not in the validator.

Object: {employeId: "jd7...", contrat: "CDI", nom: "ABO Jean"}
Validator: v.object({employeId: v.id("employes"), email: v.optional(v.string())})`,
);
const m1 = messageErreur(champEnTrop);
check("champ en trop : le champ est nommé", m1.includes("contrat"), m1);
check("champ en trop : la saisie est explicitement mise hors de cause", /saisie n'est pas en cause/.test(m1), m1);
check("champ en trop : aucun jargon de validateur ne subsiste",
  !/ArgumentValidationError|v\.object|Validator/.test(m1), m1);

// --- Champ obligatoire absent ---
const m2 = messageErreur(new Error("ArgumentValidationError: Missing required field `societe`"));
check("champ manquant : nommé et imputé à l'application", m2.includes("societe") && /défaut de l'application/.test(m2), m2);

// --- Type inattendu : seul le chemin est exploitable ---
const m3 = messageErreur(new Error("ArgumentValidationError: Value does not match validator.\nPath: salaireBase\nValue: \"abc\""));
check("type inattendu : le chemin du champ est rendu", m3.includes("salaireBase"), m3);

// --- Validation sans chemin exploitable ---
const m4 = messageErreur(new Error("ArgumentValidationError: Value does not match validator."));
check("validation sans chemin : message générique mais honnête",
  /refusé les données/.test(m4) && !/undefined/.test(m4), m4);

// --- Erreur métier : son texte est DÉJÀ écrit pour l'utilisateur, on n'y touche pas ---
const metier = new Error(
  `[CONVEX M(employes:creer)] [Request ID: abc123] Server Error
Uncaught Error: Le matricule E001 existe déjà : ABO Jean.
    at handler (../convex/employes.ts:87:25)`,
);
check("erreur métier : rendue telle quelle, sans enveloppe",
  messageErreur(metier) === "Le matricule E001 existe déjà : ABO Jean.", messageErreur(metier));

const metierMultiligne = new Error("Uncaught ConvexError: Le mois 2026-10 est clôturé : journée immuable.");
check("erreur métier ConvexError reconnue aussi",
  messageErreur(metierMultiligne) === "Le mois 2026-10 est clôturé : journée immuable.");

// --- Erreur serveur sans message : donner la référence plutôt que rien ---
const m5 = messageErreur(new Error("[CONVEX Q(users:liste)] [Request ID: fa0e097e] Server Error"));
check("erreur serveur opaque : la référence de requête est donnée", m5.includes("fa0e097e"), m5);
check("erreur serveur opaque : pas de jargon", !/CONVEX|Server Error/.test(m5), m5);

// --- Entrées dégradées ---
check("chaîne simple rendue telle quelle", messageErreur("Trop de lignes") === "Trop de lignes");
check("valeur non-Error tolérée", typeof messageErreur(null) === "string");

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); } else console.log("\nTous les tests passent.");
