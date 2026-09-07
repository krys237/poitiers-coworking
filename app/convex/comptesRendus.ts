import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireLevel } from "./lib/authz";
import { NIVEAU, Role } from "./rbac";
import { dateDouala, estDansFenetre, finFenetre, prochaineOuverture, pointsPour, heureDouala } from "./lib/fenetre";

const STATUT = v.union(v.literal("brouillon"), v.literal("en_relecture"), v.literal("valide"));
const heure = (iso: string) => { const h = heureDouala(new Date(iso)); return `${String(h.h).padStart(2, "0")}:${String(h.min).padStart(2, "0")}`; };

function etatFenetre(now = new Date()) {
  return { maintenant: now.toISOString(), ouverte: estDansFenetre(now), finA: finFenetre(now)?.toISOString() ?? null, prochaine: prochaineOuverture(now).toISOString(), aujourdHui: dateDouala(now) };
}

// Espace du membre : score, compte rendu du jour, état de la fenêtre, historique.
export const monEspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireLevel(ctx, 1);
    const fen = etatFenetre();
    const miens = (await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", user._id)).collect())
      .sort((a, b) => b.date.localeCompare(a.date));
    const score = miens.reduce((t, c) => t + c.points, 0);
    const duJour = miens.find((c) => c.date === fen.aujourdHui) ?? null;
    return {
      fenetre: fen, score, superviseur: NIVEAU[user.role as Role] >= 2,
      aujourdHui: duJour ? { ...duJour, heure: heure(duJour.soumisA) } : null,
      historique: miens.slice(0, 30).map((c) => ({ _id: c._id, date: c.date, heure: heure(c.soumisA), horsFenetre: c.horsFenetre, points: c.points, statut: c.statut, contenu: c.contenu })),
    };
  },
});

// Soumission (ou mise à jour) du compte rendu d'un jour. Hors fenêtre : accepté mais marqué, 0 point.
export const soumettre = mutation({
  args: { date: v.optional(v.string()), contenu: v.string() },
  handler: async (ctx, { date, contenu }) => {
    const user = await requireLevel(ctx, 1);
    const now = new Date();
    const jour = date ?? dateDouala(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) throw new Error("Date au format AAAA-MM-JJ.");
    if (jour > dateDouala(now)) throw new Error("Impossible de soumettre un compte rendu pour une date future.");
    if (!contenu.trim()) throw new Error("Le contenu est vide.");
    const existant = await ctx.db.query("comptesRendus").withIndex("by_auteur_date", (q) => q.eq("auteurId", user._id).eq("date", jour)).unique();
    if (existant?.statut === "valide") throw new Error("Ce compte rendu a été validé : il n'est plus modifiable.");
    // Dans la fenêtre uniquement si le jour soumis est aujourd'hui ET l'heure est dans le créneau.
    const horsFenetre = !(jour === dateDouala(now) && estDansFenetre(now));
    const points = pointsPour(horsFenetre);
    const doc = { contenu: contenu.trim(), soumisA: now.toISOString(), horsFenetre, points, statut: "en_relecture" as const };
    if (existant) await ctx.db.patch(existant._id, doc);
    else await ctx.db.insert("comptesRendus", { auteurId: user._id, date: jour, ...doc });
    return { date: jour, horsFenetre, points, heure: heure(doc.soumisA) };
  },
});

// Vue superviseur (niveau 2+) : taux de soumission, statut par membre actif, contenus du jour.
export const vueSuperviseur = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    await requireLevel(ctx, 2);
    const jour = date ?? dateDouala();
    const membres = (await ctx.db.query("users").collect()).filter((u) => u.isActive);
    const duJour = await ctx.db.query("comptesRendus").withIndex("by_date", (q) => q.eq("date", jour)).collect();
    const parAuteur = new Map(duJour.map((c) => [String(c.auteurId), c]));
    const lignes = [];
    for (const m of membres) {
      const c = parAuteur.get(String(m._id)) ?? null;
      const tous = await ctx.db.query("comptesRendus").withIndex("by_auteur", (q) => q.eq("auteurId", m._id)).collect();
      lignes.push({
        membreId: m._id, nom: m.nom ?? m.email, email: m.email, role: m.role,
        score: tous.reduce((t, x) => t + x.points, 0),
        soumis: !!c, heure: c ? heure(c.soumisA) : null, horsFenetre: c?.horsFenetre ?? null, points: c?.points ?? 0, statut: c?.statut ?? null, id: c?._id ?? null,
      });
    }
    const soumis = lignes.filter((l) => l.soumis).length;
    return {
      date: jour, fenetre: etatFenetre(), membres: membres.length, soumis, taux: membres.length ? Math.round((soumis / membres.length) * 100) : 0,
      lignes: lignes.sort((a, b) => Number(b.soumis) - Number(a.soumis) || a.nom.localeCompare(b.nom)),
      contenus: duJour.map((c) => ({ _id: c._id, auteur: membres.find((m) => m._id === c.auteurId)?.nom ?? "?", heure: heure(c.soumisA), horsFenetre: c.horsFenetre, statut: c.statut, contenu: c.contenu })),
    };
  },
});

// Statut éditorial (niveau 2+) : en_relecture → valide (ou retour brouillon / relecture).
export const changerStatut = mutation({
  args: { compteRenduId: v.id("comptesRendus"), statut: STATUT },
  handler: async (ctx, { compteRenduId, statut }) => {
    const user = await requireLevel(ctx, 2);
    const c = await ctx.db.get(compteRenduId);
    if (!c) throw new Error("Compte rendu introuvable.");
    await ctx.db.patch(compteRenduId, { statut, valideParId: statut === "valide" ? user._id : undefined });
  },
});
