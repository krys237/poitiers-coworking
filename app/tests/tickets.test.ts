// Tickets (demande N5) : `npm run test:tickets`
//
// Ce que ces tests verrouillent, et qui est le cœur du module : les DEUX PISTES restent
// indépendantes. Le Directeur juge la pertinence, le développeur la réalisation, et aucun des
// deux ne doit pouvoir écraser l'information de l'autre.
import {
  ETATS, LIBELLE_AVIS, LIBELLE_ETAT, LIBELLE_NATURE, MIN_DESCRIPTION, NATURES,
  PIECES_MAX, TAILLE_PIECE_MAX, TYPES_PIECE,
  compter, controlerArbitrage, controlerEtat, controlerPiece, controlerTicket, estClos,
  estEtat, estNature, trier,
} from "../convex/lib/tickets.ts";

let echecs = 0;
const check = (nom: string, cond: boolean, d?: unknown) => {
  if (cond) console.log("  ok  " + nom);
  else { console.error("  KO  " + nom, d ?? ""); echecs++; }
};
const titre = (s: string) => console.log(`\n— ${s}`);
const LONG = "x".repeat(MIN_DESCRIPTION);

// ===========================================================================
titre("Le vocabulaire est écrit pour un agent, pas pour un développeur");
check("trois natures", NATURES.length === 3);
check("aucune n'emploie de jargon — elles sont à la première personne",
  NATURES.every(([, l]) => /^(Quelque chose|Il me manque|Je ne comprends)/.test(l)),
  NATURES.map(([, l]) => l));
check("chaque nature a son libellé", Object.keys(LIBELLE_NATURE).length === 3);
check("les avis et les états ont tous un libellé",
  Object.keys(LIBELLE_AVIS).length === 3 && Object.keys(LIBELLE_ETAT).length === 4);
check("une nature inconnue est rejetée", !estNature("autre"));
check("un état inconnu aussi", !estEtat("ferme"));

// ===========================================================================
titre("Un ticket doit DÉCRIRE, pas seulement signaler");
check("un titre vide est refusé", controlerTicket({ titre: "", description: LONG, nature: "besoin" }).length > 0);
check("un titre de deux lettres aussi",
  controlerTicket({ titre: "ko", description: LONG, nature: "besoin" })
    .some((e) => e.includes("trop court")));
// LE contrôle qui compte : « ça ne marche pas » ne permet ni de reproduire ni de décider.
const trop = controlerTicket({ titre: "Bulletins", description: "ça ne marche pas", nature: "dysfonctionnement" });
check("une description trop courte est refusée", trop.length === 1, trop);
check("et le message dit COMBIEN il manque, puis quoi écrire",
  trop[0].includes("caractères") && trop[0].includes("ce que vous faisiez"), trop[0]);
check("une description assez longue passe",
  controlerTicket({ titre: "Bulletins", description: LONG, nature: "dysfonctionnement" }).length === 0);
check("une nature inconnue est signalée",
  controlerTicket({ titre: "Bulletins", description: LONG, nature: "zzz" })
    .some((e) => e.includes("dysfonctionnement")));
check("les espaces ne comptent pas comme description",
  controlerTicket({ titre: "Bulletins", description: " ".repeat(60), nature: "besoin" }).length > 0);
check("l'écran concerné reste facultatif",
  controlerTicket({ titre: "Bulletins", description: LONG, nature: "besoin" }).length === 0);

// ===========================================================================
titre("Un REFUS doit être motivé — un accord non");
// Asymétrie volontaire : refuser le besoin de quelqu'un sans dire pourquoi est la meilleure façon
// de le dissuader d'en signaler un autre.
check("retenir un ticket ne demande pas de motif", controlerArbitrage("pertinent").length === 0);
check("le refuser sans motif est impossible",
  controlerArbitrage("non_pertinent").some((e) => e.includes("motivé")));
check("un motif d'espaces ne compte pas",
  controlerArbitrage("non_pertinent", "   ").length > 0);
check("avec un motif, le refus passe",
  controlerArbitrage("non_pertinent", "Doublon du ticket #12").length === 0);
check("« en attente » n'est pas un avis que l'on rend", controlerArbitrage("en_attente").length > 0);
check("un avis inconnu est rejeté", controlerArbitrage("peut_etre").length > 0);

titre("Un ABANDON doit être expliqué — les autres états non");
check("passer en cours ne demande rien", controlerEtat("en_cours").length === 0);
check("marquer résolu non plus", controlerEtat("resolu").length === 0);
check("abandonner sans explication est impossible",
  controlerEtat("abandonne").some((e) => e.includes("expliqué")));
check("avec une note, l'abandon passe", controlerEtat("abandonne", "Hors périmètre").length === 0);
check("les quatre états sont connus", ETATS.every((e) => controlerEtat(e, "note").length === 0));

// ===========================================================================
titre("Pièces jointes : des captures, rien d'autre");
check("un PNG est accepté", controlerPiece({ typeMime: "image/png", taille: 1000 }) === null);
check("un PDF aussi", controlerPiece({ typeMime: "application/pdf", taille: 1000 }) === null);
check("un exécutable est refusé",
  controlerPiece({ typeMime: "application/x-msdownload", taille: 1000 })?.includes("refusé"));
check("un tableur aussi", !!controlerPiece({ typeMime: "application/vnd.ms-excel", taille: 1000 }));
check("le type refusé est NOMMÉ dans le message",
  controlerPiece({ typeMime: "video/mp4", taille: 1000 })?.includes("video/mp4"));
check("un fichier trop lourd est refusé",
  controlerPiece({ typeMime: "image/png", taille: TAILLE_PIECE_MAX + 1 })?.includes("trop lourd"));
check("la limite exacte passe",
  controlerPiece({ typeMime: "image/png", taille: TAILLE_PIECE_MAX }) === null);
check("un fichier vide est refusé",
  controlerPiece({ typeMime: "image/png", taille: 0 })?.includes("vide"));
check("cinq pièces au maximum", PIECES_MAX === 5);
check("les types acceptés sont tous des images ou des PDF",
  TYPES_PIECE.every((t) => t.startsWith("image/") || t === "application/pdf"));

// ===========================================================================
titre("Les deux pistes restent INDÉPENDANTES");
const t = (avis: string, etat: string) => ({ avis, etat, nature: "besoin", cree: "2026-11-06T10:00:00Z" });
check("pertinent mais pas traité : le ticket reste ouvert", !estClos(t("pertinent", "nouveau")));
check("résolu sans arbitrage : il est clos — un plantage n'attend pas un avis",
  estClos(t("en_attente", "resolu")));
check("non pertinent : clos, quel que soit l'état technique",
  estClos(t("non_pertinent", "nouveau")) && estClos(t("non_pertinent", "en_cours")));
check("abandonné : clos", estClos(t("pertinent", "abandonne")));
check("en attente et nouveau : ouvert", !estClos(t("en_attente", "nouveau")));

titre("Les compteurs comptent ce qui attend CHACUN");
const lot = [
  t("en_attente", "nouveau"),      // attend le Directeur ET le développeur
  t("pertinent", "en_cours"),      // attend le développeur seulement
  t("non_pertinent", "nouveau"),   // n'attend plus personne
  t("en_attente", "resolu"),       // traité sans arbitrage : plus rien à faire
];
const c = compter(lot);
check("quatre au total", c.total === 4);
check("deux ouverts", c.ouverts === 2, c);
// Un ticket clos ne compte plus comme « à arbitrer », même sans avis rendu : arbitrer un ticket
// déjà résolu n'a plus d'objet.
check("un seul à arbitrer — le résolu sans avis ne compte plus", c.aArbitrer === 1, c);
check("deux à traiter : le non arbitré compte aussi", c.aTraiter === 2, c);
check("la ventilation par nature couvre les trois natures", c.parNature.length === 3);
check("un lot vide ne casse rien", compter([]).total === 0 && compter([]).aArbitrer === 0);

titre("L'ordre d'affichage : ce qui demande une action d'abord");
const a = { ...t("en_attente", "nouveau"), cree: "2026-11-01T10:00:00Z" };
const b = { ...t("pertinent", "nouveau"), cree: "2026-11-02T10:00:00Z" };
const d = { ...t("pertinent", "en_cours"), cree: "2026-11-03T10:00:00Z" };
const e = { ...t("pertinent", "resolu"), cree: "2026-11-05T10:00:00Z" };
const ordre = trier([e, d, b, a]);
check("à arbitrer en tête, même si c'est le plus ancien", ordre[0] === a, ordre);
check("puis les nouveaux arbitrés", ordre[1] === b);
check("puis ceux en cours", ordre[2] === d);
check("les clos descendent, mais NE SONT PAS masqués", ordre[3] === e && ordre.length === 4);
// Masquer ferait perdre la trace de ce qui a été refusé — précisément ce qu'un auteur vient voir.
check("un refus reste dans la liste",
  trier([t("non_pertinent", "nouveau")]).length === 1);
check("à rang égal, le plus récent d'abord",
  trier([
    { ...t("en_attente", "nouveau"), cree: "2026-11-01T10:00:00Z" },
    { ...t("en_attente", "nouveau"), cree: "2026-11-04T10:00:00Z" },
  ])[0].cree === "2026-11-04T10:00:00Z");
check("le tri ne modifie pas le tableau d'origine", (() => {
  const src = [e, a];
  trier(src);
  return src[0] === e;
})());

if (echecs) { console.error(`\n${echecs} test(s) en échec`); process.exit(1); }
else console.log("\nTous les tests passent.");
