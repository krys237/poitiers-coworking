// Configuration des fournisseurs d'authentification OIDC.
//
// IMPORTANT : Convex analyse ce fichier statiquement au push et REFUSE toute référence
// à une variable d'environnement non définie (même dans une condition). Ne pas utiliser
// process.env ici tant que les variables ne sont pas créées sur le déploiement.
//
// En développement : aucun fournisseur, on utilise AUTH_DEV_BYPASS=true (voir lib/authz.ts).
//
// Pour activer l'OIDC (OTP e-mail + Google) :
//   1. Créer CONVEX_OIDC_DOMAIN et CONVEX_OIDC_APP_ID sur le déploiement (npx convex env set …).
//   2. Remplacer `providers: []` par :
//        providers: [{ domain: process.env.CONVEX_OIDC_DOMAIN!, applicationID: process.env.CONVEX_OIDC_APP_ID! }],
//   3. Retirer AUTH_DEV_BYPASS en production.
export default {
  providers: [],
};
