import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireDroit, droitsDuMembre } from "./lib/authz";
import { dateDouala, estDansFenetre, finFenetre, prochaineOuverture, pointsPour, heureDouala, dispenseDeFenetre, type Fenetre } from "./lib/fenetre";
import { lireReglages } from "./parametres";
import { NIVEAU, Role } from "./rbac";

const STATUT = v.union(v.literal("brouillon"), v.literal("en_relecture"), v.literal("valide"));
const heure = (iso: string) => { const h = heureDouala(new Date(iso)); return `${String(h.h).padStart(2, "0")}:${String(h.min).padStart(2, "0")}`; };

// La fenêtre vient des réglages (heures d'ouverture / fermeture, samedi) ; l'écran reçoit ses bornes.
async function fenetreDe(ctx: Parameters<typeof lireReglages>[0]): Promise<Fenetre> {
  const r = await lireReglages(ctx);
  return { ouverture: r.crHeureOuverture, fermeture: r.crHeureFermeture, samedi: r.crSamedi };
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
    const miens = (await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", user._id)).collect())
      .sort((a, b) => b.date.localeCompare(a.date));
    const score = miens.reduce((t, c) => t + c.points, 0);
    const duJour = miens.find((c) => c.date === fen.aujourdHui) ?? null;
    return {
      fenetre: fen, score, dispenseFenetre: dispense, superviseur: (await droitsDuMembre(ctx, user))["/comptes-rendus"].faire,
      aujourdHui: duJour ? { ...duJour, heure: heure(duJour.soumisA), commentaires: duJour.commentaires ?? [] } : null,
      historique: miens.slice(0, 30).map((c) => ({ _id: c._id, date: c.date, heure: heure(c.soumisA), horsFenetre: dispense ? false : c.horsFenetre, points: c.points, statut: c.statut, contenu: c.contenu, commentaires: c.commentaires ?? [] })),
    };
  },
});

// Soumission (ou mise à jour) du compte rendu d'un jour. Hors fenêtre : accepté mais marqué, 0 point.
// Décision du 19/10/2026 : les postes de niveau >= 5 (DAF, DG, Super Admin) déposent librement sans restriction de créneau.
export const soumettre = mutation({
  args: { date: v.optional(v.string()), contenu: v.string() },
  handler: async (ctx, { date, contenu }) => {
    const user = await requireDroit(ctx, "/comptes-rendus");
    const now = new Date();
    const jour = date ?? dateDouala(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error("Date au format AAAA-MM-JJ.");
    if (jour > dateDouala(now)) throw new Error("Impossible de soumettre un compte rendu pour une date future.");
    if (!contenu.trim()) throw new Error("Le contenu est vide.");
    const existant = await ctx.db.query("comptesRendus").withIndex("by_auteur_date", (q) => q.eq("auteurId", user._id).eq("date", jour)).unique();
    if (existant?.statut === "valide") throw new Error("Ce compte rendu a été validé : il n'est plus modifiable.");

    const niveau = NIVEAU[user.role as Role] ?? 0;
    const dispense = dispenseDeFenetre(niveau);
    // Dans la fenêtre si dispensé OU si (jour soumis est aujourd'hui ET heure dans le créneau).
    const horsFenetre = dispense ? false : !(jour === dateDouala(now) && estDansFenetre(now, await fenetreDe(ctx)));
    const points = pointsPour(horsFenetre);
    const doc = { contenu: contenu.trim(), soumisA: now.toISOString(), horsFenetre, points, statut: "en_relecture" as const };
    if (existant) await ctx.db.patch(existant._id, doc);
    else await ctx.db.insert("comptesRendus", { auteurId: user._id, date: jour, ...doc });
    return { date: jour, horsFenetre, points, heure: heure(doc.soumisA), dispenseFenetre: dispense };
  },
});

// Vue superviseur (niveau 2+) : taux de soumission, statut par membre actif, contenus du jour.
export const vueSuperviseur = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    await requireDroit(ctx, "/comptes-rendus", "faire");
    const jour = date ?? dateDouala();
    const membres = (await ctx.db.query("users").collect()).filter((u) => u.isActive);
    const duJour = await ctx.db.query("comptesRendus").withIndex("by_date", (q) => q.eq("date", jour)).collect();
    const parAuteur = new Map(duJour.map((c) => [String(c.auteurId), c]));
    const lignes = [];
    for (const m of membres) {
      const c = parAuteur.get(String(m._id)) ?? null;
      const tous = await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", m._id)).collect();
      const dispense = dispenseDeFenetre(NIVEAU[m.role as Role] ?? 0);
      lignes.push({
        membreId: m._id, nom: m.nom ?? m.email, email: m.email, role: m.role,
        score: tous.reduce((t, x) => t + x.points, 0),
        soumis: !!c, heure: c ? heure(c.soumisA) : null,
        horsFenetre: dispense ? false : (c?.horsFenetre ?? null),
        dispenseFenetre: dispense,
        points: c?.points ?? 0, statut: c?.statut ?? null, id: c?._id ?? null,
        nbCommentaires: (c?.commentaires ?? []).length,
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
