// Phase 4 — données de démo : auditeur externe, lignes et rapports d'audit (mois courant + précédent), journal (idempotent).
import { query, mutation } from "./_generated/server";
import { DEV_TOKEN } from "./lib/authz";
import { moisPrecedent } from "./lib/audit";
import { journaliser } from "./lib/journal";

const AUDITEUR = { token: "demo:auditeur", email: "auditeur@cabinet-audit.local", nom: "NKOLO Bertrand (auditeur)", role: "auditeur_externe" as const, poste: "Auditeur externe", departement: "Cabinet AUDIT & Co" };

const LIGNES: Record<string, { designation: string; montant: number; notes?: string }[]> = {
  externes: [
    { designation: "Dr NGONO Clarisse", montant: 450000, notes: "consultations externes" },
    { designation: "Dr FOUDA Marlyse", montant: 320000 },
    { designation: "Dr TAGNE Jean", montant: 275000, notes: "vacations week-end" },
  ],
  prescripteurs_scanner: [
    { designation: "Dr ESSOMBA Paul", montant: 180000, notes: "12 prescriptions" },
    { designation: "Dr MBARGA Louise", montant: 135000 },
  ],
  masse_salariale: [
    { designation: "Masse salariale SGC", montant: 2450000 },
    { designation: "Masse salariale SESAME", montant: 640000 },
    { designation: "Masse salariale SOFINA", montant: 310000 },
  ],
  heures_supplementaires: [
    { designation: "Service maintenance", montant: 85000, notes: "astreintes" },
    { designation: "Service accueil", montant: 42000 },
  ],
};

export const etatDemo4 = query({
  args: {},
  handler: async (ctx) => ({ phase4: !!(await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", AUDITEUR.token)).unique()) }),
});

export const phase4 = mutation({
  args: {},
  handler: async (ctx) => {
    const r = { auditeur: 0, lignes: 0, rapports: 0, journal: 0, ignores: 0 };
    const dev = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", DEV_TOKEN)).unique();
    if (!dev) throw new Error("Initialisez d'abord les données de base (membre dev).");

    let aud = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", AUDITEUR.token)).unique();
    if (!aud) {
      const id = await ctx.db.insert("users", { tokenIdentifier: AUDITEUR.token, email: AUDITEUR.email, nom: AUDITEUR.nom, role: AUDITEUR.role, poste: AUDITEUR.poste, departement: AUDITEUR.departement, isActive: true });
      aud = (await ctx.db.get(id))!; r.auditeur++;
      await journaliser(ctx, { auteurId: dev._id, auteurNom: dev.nom ?? dev.email, action: "membre_creation", cible: AUDITEUR.nom, detail: "Auditeur Externe · démo" }); r.journal++;
    } else r.ignores++;

    const courant = new Date().toISOString().slice(0, 7);
    const periodes = [moisPrecedent(courant), courant];
    for (const [i, periode] of periodes.entries()) {
      for (const [categorie, lignes] of Object.entries(LIGNES)) {
        const existe = await ctx.db.query("primesMedecins").withIndex("by_contexte_periode_categorie", (q) => q.eq("contexte", "audit").eq("periode", periode).eq("categorie", categorie)).first();
        if (existe) { r.ignores++; continue; }
        for (const l of lignes) {
          // Mois précédent : montants légèrement différents pour rendre la variation lisible.
          const montant = i === 0 ? Math.round(l.montant * 0.92) : l.montant;
          await ctx.db.insert("primesMedecins", { contexte: "audit", categorie, periode, designation: l.designation, dateDebut: `${periode}-01`, dateFin: `${periode}-28`, montant, notes: l.notes });
          r.lignes++;
        }
      }
    }

    const rapports = [
      { categorie: "externes", contenu: "Contrôle des primes des médecins externes : pièces justificatives présentes pour les 3 praticiens. Écart de 2 % constaté sur les vacations du week-end (Dr TAGNE) — à régulariser sur le mois suivant. Aucune anomalie bloquante." },
      { categorie: "masse_salariale", contenu: "Masse salariale conforme au récapitulatif de paie. Répartition SGC / SESAME / SOFINA cohérente avec les déclarations CNPS. Recommandation : archiver les bulletins PDF du mois dès la clôture." },
    ];
    for (const rp of rapports) {
      const existe = await ctx.db.query("rapportsAudit").withIndex("by_categorie_periode", (q) => q.eq("categorie", rp.categorie).eq("periode", courant)).first();
      if (existe) { r.ignores++; continue; }
      await ctx.db.insert("rapportsAudit", { categorie: rp.categorie, periode: courant, contenu: rp.contenu, auteurId: aud._id, majLe: new Date().toISOString() });
      await journaliser(ctx, { auteurId: aud._id, auteurNom: aud.nom, action: "audit_rapport", cible: `${rp.categorie} ${courant}`, detail: "rapport de démo" });
      r.rapports++; r.journal++;
    }
    return r;
  },
});
