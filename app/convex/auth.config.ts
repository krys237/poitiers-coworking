// Configuration du fournisseur d'authentification.
//
// Depuis P1, l'authentification est assurée par Convex Auth (voir `auth.ts`) : le déploiement
// signe lui-même les jetons, il n'y a plus d'IdP externe à déclarer. `applicationID: "convex"`
// est la valeur imposée par Convex Auth, et le domaine est celui du déploiement lui-même.
//
// ⚠️ PIÈGE : ce fichier est analysé STATIQUEMENT au push et toute référence à une variable
// d'environnement non définie fait échouer le déploiement (→ aucune fonction, page blanche).
// `CONVEX_SITE_URL` est une variable système, toujours présente : elle est donc sûre ici.
// Ne jamais y référencer une variable créée à la main sans l'avoir définie AVANT le push.
//
// Prérequis sur le déploiement (sinon l'application est silencieusement toujours déconnectée) :
//   npx convex env set "JWT_PRIVATE_KEY=<clé PKCS8>"
//   npx convex env set "JWKS=<JWKS JSON>"
//   npx convex env set SITE_URL http://localhost:5173     (URL du front, pour les liens e-mail)
export default {
  providers: [
    { domain: process.env.CONVEX_SITE_URL, applicationID: "convex" },
  ],
};
