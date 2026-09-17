// Authentification (Convex Auth) : mot de passe + code à usage unique par e-mail.
//
// Point clé de ce projet : la table `users` est à la fois la table d'identité de Convex Auth
// ET le registre des rôles (voir schema.ts). C'est `createOrUpdateUser` ci-dessous qui fait le
// lien — Convex Auth n'insère jamais de membre lui-même dès lors que ce callback est fourni.
//
// Règle d'or : une inscription NE DONNE AUCUN DROIT. Soit l'e-mail a été pré-provisionné par
// le Directeur Général (écran Membres) et le compte reprend le rôle prévu, soit le compte
// arrive « en attente d'autorisation » et n'accède à rien tant qu'un DG ne l'a pas activé.
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./authResendOtp";
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { PENDING_PREFIX } from "./lib/authz";
import { journaliser } from "./lib/journal";
import { LIBELLE, Role } from "./rbac";

// Les callbacks reçoivent un contexte générique (AnyDataModel) : on le ramène au modèle du
// projet pour garder `ctx.db` typé et pouvoir réutiliser `journaliser`.
const typer = (ctx: unknown) => ctx as MutationCtx;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Mot de passe : inscription et connexion par e-mail + mot de passe.
    Password({
      validatePasswordRequirements: (mot: string) => {
        if (mot.length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");
        if (!/[a-zA-Z]/.test(mot) || !/[0-9]/.test(mot)) throw new Error("Le mot de passe doit mêler lettres et chiffres.");
      },
    }),
    // Code à usage unique reçu par e-mail (utile quand le mot de passe est oublié,
    // et pour les membres qui ne veulent pas en gérer un).
    ResendOTP,
  ],

  callbacks: {
    // Seule porte d'entrée pour créer ou rattacher un membre.
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      const c = typer(ctx);
      if (existingUserId) return existingUserId as Id<"users">;

      const email = String(profile.email ?? "").trim().toLowerCase();
      if (!email) throw new Error("Une adresse e-mail est requise pour créer un compte.");

      const existant = await c.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
      if (existant) {
        // Membre pré-provisionné par le DG : on le rattache. Le jeton "pending:<email>" n'a
        // plus lieu d'être — l'identité devient l'_id de la ligne elle-même.
        if (existant.tokenIdentifier?.startsWith(PENDING_PREFIX)) {
          await c.db.patch(existant._id, { tokenIdentifier: undefined });
          await journaliser(c, {
            auteurId: existant._id, auteurNom: existant.nom ?? existant.email,
            action: "membre_rattachement", cible: email,
            detail: `première connexion · ${LIBELLE[existant.role as Role]}`,
          });
        }
        return existant._id;
      }

      // Inscription spontanée : compte créé SANS droits, en attente de validation par un DG.
      const id = await c.db.insert("users", {
        email,
        nom: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : undefined,
        role: "employe",
        isActive: false,
        enAttente: true,
      });
      await journaliser(c, {
        action: "membre_creation", cible: email,
        detail: "inscription spontanée · en attente d'autorisation",
      });
      return id;
    },

    // Dernier filtre avant l'ouverture de session.
    async beforeSessionCreation(ctx, { userId }) {
      const c = typer(ctx);
      const u = await c.db.get(userId as Id<"users">);
      if (!u) throw new Error("Compte introuvable.");

      // Un compte en attente OBTIENT une session : c'est ce qui permet d'afficher l'écran
      // « votre compte attend une validation » plutôt qu'une erreur opaque. Il n'accède à
      // rien pour autant — `requireLevel` refuse tout membre dont `isActive` est faux.
      if (!u.isActive && !u.enAttente) {
        throw new Error("Ce compte a été désactivé. Contactez le Directeur Général.");
      }

      await journaliser(c, {
        auteurId: u._id, auteurNom: u.nom ?? u.email,
        action: u.enAttente ? "connexion_attente" : "connexion",
        cible: u.email, detail: u.enAttente ? "en attente d'autorisation" : LIBELLE[u.role as Role],
      });
    },
  },
});
