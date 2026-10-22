import { query, mutation, type MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireDroit, droitsDuMembre } from "./lib/authz";
import { dateDouala, estDansFenetre, finFenetre, prochaineOuverture, pointsPour, pointsDuJour, heureDouala, dispenseDeFenetre, type Fenetre } from "./lib/fenetre";
import { lireReglages } from "./parametres";
import { NIVEAU, Role } from "./rbac";

const STATUT = v.union(v.literal("brouillon"), v.literal("en_relecture"), v.literal("valide"));
// Droit « plusieurs comptes rendus pour une même journée » (matrice des droits, rbac.MODULES).
const DROIT_PLUSIEURS = "/comptes-rendus/plusieurs-par-jour";
const heure = (iso: string) => { const h = heureDouala(new Date(iso)); return `${String(h.h).padStart(2, "0")}:${String(h.min).padStart(2, "0")}`; };

// La fenêtre vient des réglages (heures d'ouverture / fermeture, samedi) ; l'écran reçoit ses bornes.
async function fenetreDe(ctx: Parameters<typeof lireReglages>[0]): Promise<Fenetre> {
  const r = await lireReglages(ctx);
  return { ouverture: r.crHeureOuverture, fermeture: r.crHeureFermeture, samedi: r.crSamedi };
}
// Comptes rendus d'un membre pour une journée, dans l'ordre des dépôts : c'est cet ordre qui décide
// lequel porte le point de présence (voir lib/fenetre.pointsDuJour).
async function comptesRendusDuJour(ctx: MutationCtx, auteurId: Id<"users">, jour: string) {
  const l = await ctx.db.query("comptesRendus").withIndex("by_auteur_date", (q) => q.eq("auteurId", auteurId).eq("date", jour)).collect();
  return l.sort((a, b) => a.soumisA.localeCompare(b.soumisA));
}

// INVARIANT (décision du 22/10/2026) : la somme des points d'une journée ne dépasse jamais 1 et vaut
// 1 dès qu'un dépôt est dans le créneau. Recalculé après chaque écriture plutôt que figé au dépôt :
// un second dépôt hors créneau ne fait pas perdre le point déjà acquis, et un dépôt dans le créneau
// après un retard le fait gagner.
async function recalculerPointsDuJour(ctx: MutationCtx, auteurId: Id<"users">, jour: string) {
  const duJour = await comptesRendusDuJour(ctx, auteurId, jour);
  const points = pointsDuJour(duJour.map((c) => c.horsFenetre));
  for (let i = 0; i < duJour.length; i++) {
    if (duJour[i].points !== points[i]) await ctx.db.patch(duJour[i]._id, { points: points[i] });
  }
  return { pointsJour: points.reduce((t, p) => t + p, 0), nbDuJour: duJour.length };
}

function etatFenetre(f: Fenetre, now = new Date()) {
  return { maintenant: now.toISOString(), ouverte: estDansFenetre(now, f), finA: finFenetre(now, f)?.toISOString() ?? null, prochaine: prochaineOuverture(now, f).toISOString(), aujourdHui: dateDouala(now), ouverture: f.ouverture, fermeture: f.fermeture, samedi: f.samedi };
}

// Espace du membre : score, compte rendu du jour, état de la fenêtre, historique.
export const monEspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireDroit(ctx, "/comptes-rendus");
    const niveau = NIVEAU[user.role as Role] ?? 0;
    const dispense = dispenseDeFenetre(niveau);
    const fen = etatFenetre(await fenetreDe(ctx));
    if (dispense) {
      fen.ouverte = true;
    }
    const droits = await droitsDuMembre(ctx, user);
    // Plusieurs comptes rendus par jour : l'ordre est (date, heure de dépôt) pour que l'historique
    // reste lisible quand une même journée en compte plusieurs.
    const miens = (await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", user._id)).collect())
      .sort((a, b) => b.date.localeCompare(a.date) || b.soumisA.localeCompare(a.soumisA));
    const score = miens.reduce((t, c) => t + c.points, 0);
    // Liste (et non plus document unique) : la journée peut porter plusieurs dépôts, rendus dans
    // l'ordre chronologique — l'écran les affiche comme « Dépôt 1, Dépôt 2… ».
    const duJour = miens.filter((c) => c.date === fen.aujourdHui).sort((a, b) => a.soumisA.localeCompare(b.soumisA));
    return {
      fenetre: fen, score, dispenseFenetre: dispense, superviseur: droits["/comptes-rendus"].faire,
      plusieursParJour: droits[DROIT_PLUSIEURS]?.faire ?? false,
      aujourdHui: duJour.map((c) => ({ ...c, heure: heure(c.soumisA), horsFenetre: dispense ? false : c.horsFenetre, commentaires: c.commentaires ?? [] })),
      pointsDuJour: duJour.reduce((t, c) => t + c.points, 0),
      historique: miens.slice(0, 30).map((c) => ({ _id: c._id, date: c.date, heure: heure(c.soumisA), horsFenetre: dispense ? false : c.horsFenetre, points: c.points, statut: c.statut, contenu: c.contenu, commentaires: c.commentaires ?? [] })),
    };
  },
});

// Dépôt d'un compte rendu pour un jour. Hors fenêtre : accepté mais marqué, 0 point.
// Décision du 19/10/2026 : les postes de niveau >= 5 (DAF, DG, Super Admin) déposent librement sans restriction de créneau.
// Décision du 22/10/2026 : avec le droit « plusieurs par jour », le dépôt S'AJOUTE à la journée ;
// sans ce droit, il REMPLACE le compte rendu du jour (comportement d'origine). Dans les deux cas,
// les points de la journée sont recalculés : une journée ne vaut jamais plus d'un point.
// La correction du texte d'un compte rendu déjà déposé passe par `modifier` (ni heure ni point touchés).
export const soumettre = mutation({
  args: { date: v.optional(v.string()), contenu: v.string() },
  handler: async (ctx, { date, contenu }) => {
    const user = await requireDroit(ctx, "/comptes-rendus");
    const plusieurs = (await droitsDuMembre(ctx, user))[DROIT_PLUSIEURS]?.faire ?? false;
    const now = new Date();
    const jour = date ?? dateDouala(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error("Date au format AAAA-MM-JJ.");
    if (jour > dateDouala(now)) throw new Error("Impossible de soumettre un compte rendu pour une date future.");
    if (!contenu.trim()) throw new Error("Le contenu est vide.");

    const duJour = await comptesRendusDuJour(ctx, user._id, jour);
    // Sans le droit, on remplace le dernier compte rendu de la journée. (Il peut en exister plusieurs
    // si le droit a été retiré depuis : on remplace alors le plus récent plutôt que d'échouer.)
    const existant = plusieurs ? null : duJour[duJour.length - 1] ?? null;
    if (existant?.statut === "valide") throw new Error("Ce compte rendu a été validé : il n'est plus modifiable.");

    const niveau = NIVEAU[user.role as Role] ?? 0;
    const dispense = dispenseDeFenetre(niveau);
    // Dans la fenêtre si dispensé OU si (jour soumis est aujourd'hui ET heure dans le créneau).
    const horsFenetre = dispense ? false : !(jour === dateDouala(now) && estDansFenetre(now, await fenetreDe(ctx)));
    const doc = { contenu: contenu.trim(), soumisA: now.toISOString(), horsFenetre, points: pointsPour(horsFenetre), statut: "en_relecture" as const };
    let id: Id<"comptesRendus">;
    if (existant) { await ctx.db.patch(existant._id, doc); id = existant._id; }
    else id = await ctx.db.insert("comptesRendus", { auteurId: user._id, date: jour, ...doc });

    // L'invariant de la journée l'emporte sur le point calculé à l'instant du dépôt.
    const { pointsJour, nbDuJour } = await recalculerPointsDuJour(ctx, user._id, jour);
    const points = (await ctx.db.get(id))?.points ?? 0;
    return { date: jour, horsFenetre, points, pointsJour, nbDuJour, ajout: !existant, heure: heure(doc.soumisA), dispenseFenetre: dispense };
  },
});

// Correction du texte d'un compte rendu déjà déposé, par son auteur (décision du 22/10/2026).
// Volontairement, la correction ne retouche NI `horsFenetre`, NI `points`, NI `soumisA` : réparer une
// faute de frappe ne doit pas coûter au collaborateur le point de présence acquis, ni réécrire l'heure
// de dépôt que lit la supervision. Un compte rendu validé reste figé.
export const modifier = mutation({
  args: { compteRenduId: v.id("comptesRendus"), contenu: v.string() },
  handler: async (ctx, { compteRenduId, contenu }) => {
    const user = await requireDroit(ctx, "/comptes-rendus");
    const c = await ctx.db.get(compteRenduId);
    if (!c) throw new Error("Compte rendu introuvable.");
    if (String(c.auteurId) !== String(user._id)) throw new Error("Vous ne pouvez corriger que vos propres comptes rendus.");
    if (c.statut === "valide") throw new Error("Ce compte rendu a été validé : il n'est plus modifiable.");
    if (!contenu.trim()) throw new Error("Le contenu est vide.");
    // Un compte rendu renvoyé en brouillon par le superviseur retourne dans sa file de relecture
    // dès qu'il est corrigé — sinon la correction resterait invisible pour lui.
    const statut = c.statut === "brouillon" ? ("en_relecture" as const) : c.statut;
    await ctx.db.patch(compteRenduId, { contenu: contenu.trim(), statut });
    return { date: c.date, heure: heure(c.soumisA), points: c.points };
  },
});

// Vue superviseur (niveau 2+) : taux de soumission, statut par membre actif, contenus du jour.
export const vueSuperviseur = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    await requireDroit(ctx, "/comptes-rendus", "faire");
    const jour = date ?? dateDouala();
    const membres = (await ctx.db.query("users").collect()).filter((u) => u.isActive);
    // Décision du 22/10/2026 : un membre peut avoir plusieurs comptes rendus pour la journée. On les
    // regroupe par auteur dans l'ordre des dépôts ; aucun nombre attendu n'est suivi — `soumis` reste
    // « a déposé au moins un compte rendu ».
    const duJour = (await ctx.db.query("comptesRendus").withIndex("by_date", (q) => q.eq("date", jour)).collect())
      .sort((a, b) => a.soumisA.localeCompare(b.soumisA));
    const parAuteur = new Map<string, typeof duJour>();
    for (const c of duJour) parAuteur.set(String(c.auteurId), [...(parAuteur.get(String(c.auteurId)) ?? []), c]);
    const lignes = [];
    for (const m of membres) {
      const siens = parAuteur.get(String(m._id)) ?? [];
      // La ligne porte le DERNIER dépôt (heure, statut, actions) ; le panneau déplié montre les autres.
      const c = siens[siens.length - 1] ?? null;
      const tous = await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", m._id)).collect();
      const dispense = dispenseDeFenetre(NIVEAU[m.role as Role] ?? 0);
      lignes.push({
        membreId: m._id, nom: m.nom ?? m.email, email: m.email, role: m.role,
        score: tous.reduce((t, x) => t + x.points, 0),
        soumis: siens.length > 0, nbDepots: siens.length, heure: c ? heure(c.soumisA) : null,
        // Journée « hors créneau » seulement si AUCUN de ses dépôts n'est tombé dans le créneau :
        // c'est la même règle que le point de présence.
        horsFenetre: dispense ? false : (siens.length ? siens.every((x) => x.horsFenetre) : null),
        dispenseFenetre: dispense,
        points: siens.reduce((t, x) => t + x.points, 0), statut: c?.statut ?? null, id: c?._id ?? null,
        nbCommentaires: siens.reduce((t, x) => t + (x.commentaires ?? []).length, 0),
      });
    }
    const soumis = lignes.filter((l) => l.soumis).length;
    return {
      date: jour, fenetre: etatFenetre(await fenetreDe(ctx)), membres: membres.length, soumis, taux: membres.length ? Math.round((soumis / membres.length) * 100) : 0,
      lignes: lignes.sort((a, b) => Number(b.soumis) - Number(a.soumis) || a.nom.localeCompare(b.nom)),
      contenus: duJour.map((c) => {
        const m = membres.find((mem) => mem._id === c.auteurId);
        const dispense = dispenseDeFenetre(NIVEAU[m?.role as Role] ?? 0);
        return {
          _id: c._id,
          auteur: m?.nom ?? "?",
          auteurId: c.auteurId,
          heure: heure(c.soumisA),
          horsFenetre: dispense ? false : c.horsFenetre,
          dispenseFenetre: dispense,
          statut: c.statut,
          contenu: c.contenu,
          commentaires: c.commentaires ?? [],
        };
      }),
    };
  },
});

// Statut éditorial (niveau 2+) : en_relecture → valide (ou retour brouillon / relecture), avec commentaire optionnel.
export const changerStatut = mutation({
  args: {
    compteRenduId: v.id("comptesRendus"),
    statut: STATUT,
    commentaire: v.optional(v.string()),
  },
  handler: async (ctx, { compteRenduId, statut, commentaire }) => {
    const user = await requireDroit(ctx, "/comptes-rendus", "faire");
    const c = await ctx.db.get(compteRenduId);
    if (!c) throw new Error("Compte rendu introuvable.");
    const auteur = user.nom ?? user.email;
    let commentaires = c.commentaires ?? [];
    if (commentaire?.trim()) {
      commentaires = [
        ...commentaires,
        {
          auteur,
          auteurId: user._id,
          texte: commentaire.trim(),
          date: new Date().toISOString(),
        },
      ];
    }
    await ctx.db.patch(compteRenduId, {
      statut,
      valideParId: statut === "valide" ? user._id : undefined,
      commentaires: commentaires.length ? commentaires : undefined,
    });
  },
});

// Ajouter une remarque ou instruction pour le collaborateur (ou réponse du collaborateur).
export const ajouterCommentaire = mutation({
  args: {
    compteRenduId: v.id("comptesRendus"),
    texte: v.string(),
  },
  handler: async (ctx, { compteRenduId, texte }) => {
    const user = await requireDroit(ctx, "/comptes-rendus", "faire");
    if (!texte.trim()) throw new Error("Commentaire vide.");
    const c = await ctx.db.get(compteRenduId);
    if (!c) throw new Error("Compte rendu introuvable.");

    const auteur = user.nom ?? user.email;
    const nouveau = {
      auteur,
      auteurId: user._id,
      texte: texte.trim(),
      date: new Date().toISOString(),
    };
    const existants = c.commentaires ?? [];
    await ctx.db.patch(compteRenduId, {
      commentaires: [...existants, nouveau],
    });
    return nouveau;
  },
});
