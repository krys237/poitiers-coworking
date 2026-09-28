# Journal des décisions

Décisions prises par le propriétaire du projet, dans l'ordre. Chaque entrée dit ce qui a été décidé, pourquoi,
et où c'est appliqué dans le code. Une consigne notée ici s'applique partout, pas seulement à l'écran où elle
a été formulée.

| Date | Décision | Pourquoi | Appliqué dans |
| --- | --- | --- | --- |
| 17/09/2026 | Formalisme des chiffres : milliers séparés, décimales à la virgule, unité séparée, zéro = champ vide avec placeholder « 0 » | Lecture des montants en FCFA sans ambiguïté | skill `poitiers-ui-ux-system` §3, `lib/format.ts`, `champs.tsx` |
| 18/09/2026 | « L'utilisateur qui a n éléments à saisir ne clique pas n fois » : champs persistants activables sur chaque écran de saisie en série | Rythme de saisie des services | skill §7, `saisie-persistante.tsx` |
| 18/09/2026 | Tous les tableaux : défilement intégré et nombre de lignes visibles au choix | C'est un ERP, pas une page web | skill §8, `lignes-visibles.tsx`, `ui/table.tsx` |
| 18/09/2026 | Récapitulatif salaires : option C (synthèse + volet) par défaut, « Rendre les champs persistants » bascule sur l'option A (grille) | Compromis lisibilité / vitesse de saisie | `pages/recap/*` |
| 21/09/2026 | Le niveau 6 (DA2) est retiré ; DA1 devient « Directeur Administratif (DAF) » | Aucun droit ne distinguait DA2 de DA1 | `convex/rbac.ts` |
| 21/09/2026 | Rôle **super administrateur** (niveau 8), technique : données de démo, fiche API, état du déploiement. Un DG ne peut pas l'attribuer | Séparer ce qui touche au code de ce qui touche à la clinique | `rbac.ts`, `users.ts`, `seed*.ts` |
| 21/09/2026 | Les niveaux exacts des autres rôles restent à trancher avec chaque spécialiste (comptable, DAF, RH) | Décision métier, pas technique | en attente (S2-5 du plan) |
| 21/09/2026 | « Rôles & accès » vit dans Paramètres ; Paramètres porte tout réglage non visible par l'utilisateur | Un seul endroit pour ce qui se règle une fois | `Parametres.tsx`, `lib/reglages.ts` |
| 21/09/2026 | Pas d'icône décorative sur pastille colorée ; sélecteur de section = contrôle segmenté, actif en fond océan | Charte | skill §4, `Parametres.tsx` |
| 21/09/2026 | Bulletin de paie refondu selon la maquette validée : lignes à zéro normales (estompées), net en bleu sceau, « Payé par » dans la zone salarié. Formules et rubriques inchangées | Validation du propriétaire sur maquette | `BulletinCard.tsx`, `paiePdf.ts`, `documents.css` |
| 21/09/2026 | **Téléphone : l'indicatif du pays est obligatoire partout** où un numéro est saisi ; stockage `+2376XXXXXXXX`, affichage groupé | Le numéro sert d'identifiant de connexion et doit être sans ambiguïté | `lib/telephone.ts`, `users.ts`, `Membres.tsx`, `Login.tsx` |
| 21/09/2026 | Connexion par e-mail **ou** numéro de téléphone + mot de passe ; pas d'inscription ni de code par e-mail sur l'écran (comptes pré-provisionnés). Compromis accepté : la correspondance numéro exact → e-mail est une requête publique | Comptes existants seulement pour l'instant ; pas de compte Resend | `Login.tsx`, `users.emailPourIdentifiant` |
| 21/09/2026 | `AUTH_DEV_BYPASS` coupé sur le déploiement : connexion obligatoire partout ; le technique passe par `superadmin.test@poitiers.local` (mot de passe à changer) | Le lien Vercel ne doit plus donner tous les droits | déploiement `wonderful-shark-673` |
| 21/09/2026 | Mise en service visée le vendredi 10 octobre 2026 (plan d'avancement 3 semaines) | — | plan d'avancement |
| 28/09/2026 | Le document s'intitule **« BULLETIN DU MOIS »** (écran, impression, PDF) ; dans Paramètres, « Raison sociale » devient « Nom de l'entreprise » | Libellés compris par les utilisateurs | `BulletinCard.tsx`, `paiePdf.ts`, `Parametres.tsx` |
| 28/09/2026 | Mode test : le mot de passe du super administrateur reste inchangé jusqu'à la mise en production | Comptes de test uniquement | déploiement `wonderful-shark-673` |
| 28/09/2026 | Auditeur externe : **pas** les droits du directeur ; accès aux modules sauf Paramètres, Journal d'activité, Archives et documents de la structure | Demande de M. GAMBOU, précisée par le propriétaire | `rbac.ts` (défauts), fait le 28/09 |
| 28/09/2026 | Le comptable (même rôle, pas de « comptable chef » distinct) accède en plus au récapitulatif financier et au grand livre | Demande de M. GAMBOU | `rbac.celluleParDefaut`, fait le 28/09 |
| 28/09/2026 | Les droits ne suivent plus seulement la hiérarchie « N voit tout ce que voit N−1 » : le directeur choisit **qui voit et qui fait quoi**, module par module, depuis la matrice de Paramètres → Rôles & accès | La hiérarchie stricte est trop grossière pour l'usage visé | fait le 28/09 : `rbac.MODULES` / `droitsEffectifs`, `lib/authz.requireDroit`, Paramètres → Rôles & accès (matrice + exceptions par personne) |
| 28/09/2026 | Le courrier de paie part par e-mail **et/ou par WhatsApp** au numéro WhatsApp de l'employé, envoyé par l'application (pas d'ouverture manuelle de WhatsApp) | Demande de M. GAMBOU | UltraMsg retenu, voir plus bas |
| 28/09/2026 | Droits en deux cases par module : **Voir** et **Faire** (niveau de détail « a ») ; l'auditeur n'a pas non plus les comptes rendus (rapports quotidiens du personnel) | Simplicité et délai ; un externe n'a pas de compte rendu à rédiger | `rbac.MODULES` |
| 28/09/2026 | Courrier WhatsApp via **UltraMsg** (compte existant) ; e-mail via Resend. **Simulation** tant que les clés et le domaine ne sont pas fournis | Le propriétaire fournira les clés | fait le 28/09 : `paiePdf.envoyerCourrier` (canaux), Paramètres → Courrier & e-mail |
| 28/09/2026 | Super administrateur absent de la matrice Rôles & accès du directeur (compte technique du développeur, garde tout) | Le DG n'a pas à le régler | `Parametres.tsx` |
| 28/09/2026 | **Retirer un droit fait disparaître les actions qui en dépendent** : droit retiré à un rôle (tout ce niveau d'accès) ou à une personne → boutons, liens, saisies liés à ce droit ne sont plus visibles pour eux. Écrans à mettre en conformité, vérifié au cahier de recette | Consigne du propriétaire | `ETAT-DU-PROJET.md` §3, `usePeut` / `<SiDroit>` |
| 28/09/2026 | « Mes bulletins » : l'employé voit ses bulletins des **mois clôturés** seulement ; compte relié à sa fiche dans Membres (sinon par e-mail) | Un bulletin provisoire peut changer | `mesBulletins.ts`, `MesBulletins.tsx` |
| 28/09/2026 | Caisse & primes médecins : ligne modifiable 60 min après saisie (réglable), ensuite seul le droit « modifier après le délai » (DG) ; correction tardive journalisée | Demande de M. GAMBOU | `stats.ts`, `lib/reglages.ts` |
| 28/09/2026 | Documents : destinataires nominatifs possibles — le document n'est alors visible que par eux et le déposant, quel que soit leur niveau | Demande de M. GAMBOU | `documents.ts`, `Documents.tsx` |
| 28/09/2026 | **L'indicatif du pays est pré-rempli (+237), jamais retapé** : partout, on ne saisit que le numéro ; un numéro importé sans indicatif reçoit +237. (Complète la consigne du 21/09 : l'indicatif reste stocké avec chaque numéro.) | Consigne du propriétaire | `ChampTelephone`, `lib/telephone.avecIndicatif` |
| 28/09/2026 | Test d'envoi WhatsApp réel reporté : instance UltraMsg en standby ; on avance en simulation | Constat du propriétaire | `ETAT-DU-PROJET.md` §2 |
| 28/09/2026 | Bulletins du mois : PDF à la demande (mois entier ou un salarié), généré sans être stocké | Demande de M. GAMBOU | `paiePdf.pdfBulletins` |
