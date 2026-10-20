# Audit & Review — Sécurité, Failles et Risques Processus

> Document de revue consignant les vulnérabilités, failles logiques, risques d'intégrité métier et limitations de scalabilité identifiés sur la plateforme **POITIERS COWORKING / POLYCLINIQUE**.  
> **Date de rédaction :** 19 octobre 2026  
> **Statut :** Planifié pour remédiation ultérieure  

---

## Sommaire des Priorités

| ID | Priorité | Domaine | Problème identifié | Fichiers concernés |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **P0 (Critique)** | Authentification | Mot de passe provisoire statique universel (`Cowork2026`) + énumération publique | `convex/lib/motDePasse.ts`, `convex/users.ts` |
| **SEC-02** | **P0 (Critique)** | Contrôle d'accès | `doitChangerMotDePasse` non vérifié côté serveur Convex | `convex/lib/authz.ts` |
| **SEC-03** | **P1 (Élevé)** | Réseau / Proxy | Usurpation d'adresse IP (`X-Forwarded-For`) dans le proxy API | `api-proxy/server.mjs` |
| **SEC-04** | **P1 (Élevé)** | Confidentialité | Extraction IA possible sur fichiers hors table `documents` (bulletins, relevés) | `convex/documents.ts`, `convex/documentsIa.ts` |
| **MET-01** | **P2 (Important)**| Intégrité Financière| `recalculerSuivantes` modifie les mois déjà clôturés et certifiés | `convex/financier.ts` |
| **MET-02** | **P2 (Important)**| Validation Caisse | Pas de validation de bornes/négatifs dans la caisse & imports non filtrés | `convex/caisse.ts` |
| **MET-03** | **P2 (Important)**| Concurrence / ID | Numérotation séquentielle vulnérable aux race conditions (`length + 1`) | `convex/commandes.ts`, `convex/interventions.ts` |
| **PERF-01**| **P3 (Moyen)**    | Performance Convex| Requêtes N+1 et scans de tables récurrents | `convex/comptesRendus.ts`, `convex/financier.ts` |

---

## 1. P0 — Failles Critiques d'Authentification

### SEC-01 · Mot de passe provisoire statique (`Cowork2026`) & énumération d'identifiants
- **Fichiers :**
  - [`convex/lib/motDePasse.ts`](file:///D:/Test/Js/coworking/app/convex/lib/motDePasse.ts#L6)
  - [`convex/users.ts`](file:///D:/Test/Js/coworking/app/convex/users.ts#L74-L84)
- **Constat :**
  1. `MOT_DE_PASSE_PROVISOIRE = "Cowork2026"` est fixé en dur pour tout compte créé ou réinitialisé.
  2. La requête `users.emailPourIdentifiant` est publique et sans authentification. N'importe qui sur Internet peut tester des séries de numéros de téléphone (+237 6...) pour vérifier s'ils ont un compte actif et récupérer l'e-mail associé.
- **Risque d'exploitation :**
  - Lorsqu'un compte (collaborateur, RH, DAF ou DG) est créé ou réinitialisé, un attaquant connaissant son numéro ou son e-mail peut immédiatement se connecter avec `Cowork2026` avant le titulaire légitime, définir un nouveau mot de passe et prendre le contrôle total du compte.
- **Remédiation prévue :**
  - Générer un code/mot de passe temporaire cryptographiquement aléatoire et unique par utilisateur.
  - Définir une durée de validité courte (ex. 15 à 60 minutes) après laquelle le compte doit être réactivé.
  - Envoyer ce code de manière sécurisée par canal individuel direct (WhatsApp/SMS via UltraMsg ou e-mail dédié).
  - Ajouter un rate-limiting strict sur la requête `users.emailPourIdentifiant`.

---

### SEC-02 · Absence d'application de `doitChangerMotDePasse` côté serveur
- **Fichiers :**
  - [`convex/lib/authz.ts`](file:///D:/Test/Js/coworking/app/convex/lib/authz.ts#L35-L40)
  - [`src/auth/Guard.tsx`](file:///D:/Test/Js/coworking/app/src/auth/Guard.tsx#L108)
- **Constat :**
  - L'obligation de renouvellement du mot de passe provisoire n'est appliquée que côté front-end par le composant React `<PortailAuth>`.
  - La fonction de validation côté serveur `lib/authz.ts:verifierCompte` ne vérifie jamais le drapeau `user.doitChangerMotDePasse`.
- **Risque d'exploitation :**
  - Un attaquant ou un client non officiel interagissant directement avec l'API WebSocket ou HTTP de Convex peut exécuter des queries et des mutations sans jamais changer le mot de passe temporaire, contournant la politique de sécurité.
- **Remédiation prévue :**
  - Intégrer dans `lib/authz.ts:verifierCompte` :
    ```typescript
    if (user.doitChangerMotDePasse) {
      throw new Error("Changement de mot de passe obligatoire avant d'accéder à l'application.");
    }
    ```
  - Autoriser uniquement les fonctions nécessaires au renouvellement (`compte.changerMotDePasse` et `users.me`).

---

## 2. P1 — Failles Élevées d'Isolation & Réseau

### SEC-03 · Contournement de l'Allowlist IP et du Rate Limiting dans `api-proxy`
- **Fichiers :**
  - [`api-proxy/server.mjs`](file:///D:/Test/Js/coworking/app/api-proxy/server.mjs#L27)
- **Constat :**
  - Le proxy extrait l'adresse IP du client via :
    ```javascript
    const ip = normaliserIp((req.headers["x-forwarded-for"] ?? "").toString().split(",")[0] || req.socket.remoteAddress);
    ```
- **Risque d'exploitation :**
  - Si le proxy est exposé directement, un appelant externe peut injecter un faux en-tête `X-Forwarded-For: 127.0.0.1` (ou une IP autorisée dans `ALLOWED_IPS`) pour franchir la restriction d'IP et faire tourner la valeur pour échapper au limiteur de débit.
- **Remédiation prévue :**
  - Si le proxy est directement exposé, n'utiliser que `req.socket.remoteAddress`.
  - Si le proxy est derrière un reverse proxy certifié, s'assurer que ce dernier écrase impérativement `X-Forwarded-For`.

---

### SEC-04 · Fuite de fichiers sensibles via l'extraction IA (`documentsIa.ts`)
- **Fichiers :**
  - [`convex/documents.ts`](file:///D:/Test/Js/coworking/app/convex/documents.ts#L138-L146)
  - [`convex/documentsIa.ts`](file:///D:/Test/Js/coworking/app/convex/documentsIa.ts#L30-L40)
- **Constat :**
  - `controleAccesFichier` recherche le `fichierId` dans la table `documents`.
  - Si le fichier n'est pas dans `documents` (ex : pièces justificatives financières `journeesFinancieres.pieces`, bulletins archivés `bulletins.pdfId`, photos d'interventions), `doc` vaut `null`.
  - La condition `if (doc && !peutVoir(...))` est alors ignorée et l'accès est autorisé par défaut.
- **Risque d'exploitation :**
  - Tout utilisateur ayant le droit basique de voir `/documents` peut fournir l'ID `_storage` d'un bulletin de paie ou d'un justificatif comptable et obtenir l'extraction textuelle ou l'analyse IA de son contenu.
- **Remédiation prévue :**
  - Si aucun enregistrement n'existe dans `documents`, refuser l'accès par défaut, sauf si le fichier a été téléversé par l'utilisateur connecté dans une fenêtre temporelle immédiate (ex. upload en cours).

---

## 3. P2 — Risques Métier & Intégrité des Données

### MET-01 · Altération silencieuse des mois clôturés (`recalculerSuivantes`)
- **Fichiers :**
  - [`convex/financier.ts`](file:///D:/Test/Js/coworking/app/convex/financier.ts#L58-L67)
- **Constat :**
  - Lors d'une modification d'une journée non clôturée, `recalculerSuivantes` parcourt et met à jour en chaîne toutes les journées avec `q.gt("date", date)`.
  - Aucune vérification n'est effectuée sur `s.cloture` ou sur `moisCloture(ctx, s.periode)`.
- **Risque d'exploitation :**
  - Une correction apportée sur un mois ancien ou une date antérieure modifie et écrase les soldes d'un mois déjà clôturé, audité et figé.
- **Remédiation prévue :**
  - Stopper la répercussion dès qu'une journée clôturée est atteinte, ou empêcher toute écriture sur une date antérieure à la date de la dernière clôture mensuelle.

---

### MET-02 · Absence de validation des montants et des imports dans la Caisse
- **Fichiers :**
  - [`convex/caisse.ts`](file:///D:/Test/Js/coworking/app/convex/caisse.ts#L29-L63)
- **Constat :**
  - Aucun garde-fou n'empêche la saisie de montants négatifs ou aberrants dans les postes de caisse (`caissePP`, `sortiesDuJour`, etc.).
  - La mutation `importer` n'effectue aucun contrôle de cohérence sur les dates (`dateFin >= dateDebut`) ni sur le verrouillage éventuel de la période.
- **Remédiation prévue :**
  - Aligner la validation sur celle de la paie (`payroll.ts`) : `x >= 0 && Number.isFinite(x)` et respect du plafond de saisie paramétré.

---

### MET-03 · Risque de collision sur la numérotation séquentielle des commandes & interventions
- **Fichiers :**
  - [`convex/commandes.ts`](file:///D:/Test/Js/coworking/app/convex/commandes.ts#L155)
  - [`convex/interventions.ts`](file:///D:/Test/Js/coworking/app/convex/interventions.ts#L82)
- **Constat :**
  - La référence est calculée par `existantes.length + 1`.
- **Risque d'exploitation :**
  - En cas de création concurrente au même instant par deux utilisateurs, les deux transactions peuvent générer la même référence (`CMD-2026-005`).
  - En cas de suppression d'une commande passée, les numéros peuvent entrer en collision avec des commandes ultérieures.
- **Remédiation prévue :**
  - Mettre en place un compteur atomique par année ou déduire la séquence du numéro le plus élevé (`Math.max(...numeros) + 1`).

---

## 4. P3 — Performance & Limites Convex

### PERF-01 · Boucles de requêtes N+1 et scans de tables (`collect()`)
- **Fichiers :**
  - [`convex/comptesRendus.ts`](file:///D:/Test/Js/coworking/app/convex/comptesRendus.ts#L65-L75)
  - [`convex/financier.ts`](file:///D:/Test/Js/coworking/app/convex/financier.ts#L217)
- **Constat :**
  - `vueSuperviseur` effectue une requête `comptesRendus.by_auteur` pour chaque membre actif dans une boucle.
  - `purgerVerrousExpires` charge l'ensemble de la table `journeesFinancieres` avec `.collect()` sans index d'expiration.
- **Remédiation prévue :**
  - Agréger les scores dans un index mensuel ou persister le cumul sur la fiche membre.
  - Créer un index `by_verrou` sur les journées ayant un verrou actif.
