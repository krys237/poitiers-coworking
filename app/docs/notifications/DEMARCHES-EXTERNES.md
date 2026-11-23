# Démarches externes — à lancer par le propriétaire

> Ces deux démarches ne sont pas du code et **ne peuvent pas être faites par un agent** :
> elles exigent des identifiants et des comptes. Elles bloquent les lots S3, S4 et S5.
>
> **À lancer en parallèle du travail de l'agent, pas avant.** L'agent a S1 et S2 devant lui,
> qui ne dépendent d'aucune des deux.

---

# Démarche 1 · Les huit modèles WhatsApp

**Bloque** : S3 (six modèles) et S5 (deux modèles).
**Délai** : validation par l'administrateur du hub, puis **jusqu'à 24 h de revue Meta par
modèle**. Les dépôts se font en parallèle, donc compte ~48 h en tout, pas 8 × 24 h.
**Irréversible** : un modèle approuvé **n'est pas modifiable**. Pour changer un mot, il faut
en déposer un nouveau sous un autre nom. **Relis les textes avant de déposer.**

## Étape 1.1 — Écrire à l'administrateur du hub

Le contact n'est pas renseigné dans la documentation (§14 : « *à compléter* »). Trouve-le,
puis envoie ceci.

> **Objet : Création d'une application sur le hub de notifications — POITIERS COWORKING**
>
> Bonjour,
>
> Nous souhaitons envoyer des notifications WhatsApp depuis la plateforme de gestion de la
> Polyclinique de Poitiers. Pourriez-vous créer l'application sur le hub et nous
> transmettre les accès ?
>
> - **Nom de l'application** : POITIERS COWORKING
> - **Identifiant souhaité** : `poitiers`
> - **Préfixe de modèles souhaité** : `poitiers_`
> - **Contact technique** : *(ton nom et ton e-mail)*
> - **Scopes nécessaires** : `messages:send`, `messages:read`, `templates:read` et
>   **`templates:write`** (nous déposerons nous-mêmes huit modèles)
> - **Volume estimé** : une centaine de messages par jour au maximum, tous
>   **transactionnels** (catégorie `UTILITY`). Aucun message marketing, donc pas besoin
>   d'autorisation marketing ni de gestion de consentement.
>
> Nous aurions besoin de :
> 1. la **clé API** (`nhk_…`), par un canal sûr ;
> 2. la confirmation du **préfixe** attribué ;
> 3. *(optionnel, voir ci-dessous)* une **URL de rappel** et son **secret de signature**
>    (`whsec_…`) pour recevoir les statuts de livraison.
>
> Pour les rappels de statut, nous souhaiterions les événements `message.failed`,
> `message.delivered` et `template_request.decided`, sur l'URL :
> `https://<notre-deploiement>.convex.site/hooks/whatsapp`
> *(l'URL exacte sera confirmée quand le lot S3 sera déployé — elle peut être configurée
> plus tard, ce n'est pas bloquant)*
>
> Enfin : le hub permet-il d'envoyer un **document** (PDF) en pièce jointe ? La
> documentation ne décrit que des modèles de texte. Nous envoyons aujourd'hui les bulletins
> de paie en PDF par un autre fournisseur et aimerions savoir si le hub pourra les porter à
> terme. Ce n'est pas bloquant pour nous.
>
> Merci d'avance,

### Pourquoi demander `templates:write`

Sans ce scope, c'est l'administrateur qui doit déposer les huit modèles à ta place — plus
d'allers-retours, et tu ne peux pas corriger un refus toi-même. Avec, tu déposes et tu suis
l'avancement.

## Étape 1.2 — Poser la clé

Dès réception, **sur le déploiement Convex**, jamais dans `app/.env.local` (les fonctions
Convex ne le lisent pas) :

```bash
cd app
npx convex env set NOTIFICATION_HUB_URL https://notifications.edoctor-tim.com/api/v1
npx convex env set -- NOTIFICATION_HUB_API_KEY "nhk_<prefixe>_<secret>"
# si les rappels de statut sont activés :
npx convex env set -- NOTIFICATION_HUB_CALLBACK_SECRET "whsec_<secret>"
```

> ⚠️ Le séparateur `--` est **obligatoire** pour toute valeur qui pourrait commencer par un
> tiret : sans lui, la CLI Convex prend la valeur pour une option et échoue silencieusement
> sur la seconde variable. C'est un piège déjà payé sur ce projet.

Vérifie l'accès :

```bash
curl -sS -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" "$NOTIFICATION_HUB_URL/me/"
```

Tu dois voir `"status": "active"`, tes scopes, et surtout **`expires_at`** : note cette date,
une clé expirée est refusée et la rotation se demande **avant** l'échéance.

## Étape 1.3 — Déposer les huit modèles

Un script prêt à l'emploi : **`outils/deposer-modeles.mjs`**. Sans dépendance, lisant les
variables d'environnement.

```bash
cd app/docs/notifications/outils
export NOTIFICATION_HUB_URL="https://notifications.edoctor-tim.com/api/v1"
export NOTIFICATION_HUB_API_KEY="nhk_…"

node deposer-modeles.mjs --verifier    # contrôle l'accès et liste les modèles déjà en place
node deposer-modeles.mjs --simuler     # affiche les 8 charges JSON sans rien envoyer
node deposer-modeles.mjs --deposer     # dépose réellement
node deposer-modeles.mjs --suivre      # état de chaque demande
```

**Lance `--simuler` d'abord, et relis les huit textes.** C'est le dernier moment où ils sont
modifiables.

### Les huit modèles, et à quoi ils servent

| Modèle | Lot | Variables (dans l'ordre) |
|---|---|---|
| `poitiers_bon_a_valider` | S3 | 1 référence · 2 nom du demandeur |
| `poitiers_bon_arbitre` | S3 | 1 référence · 2 décision · 3 motif |
| `poitiers_litige_commande` | S3 | 1 référence · 2 motif |
| `poitiers_intervention_a_arbitrer` | S3 | 1 référence · 2 objet |
| `poitiers_intervention_suite` | S3 | 1 référence · 2 décision |
| `poitiers_document_partage` | S3 | 1 titre · 2 nom du déposant |
| `poitiers_rappel_compte_rendu` | **S5** | 1 date · 2 heure de fermeture |
| `poitiers_dossier_en_attente` | **S5** | 1 référence · 2 durée d'attente |

Les textes exacts sont dans `S3-HUB-WHATSAPP.md` §4 et dans le script.

### Choix de rédaction, pour que tu puisses les discuter

- **Catégorie `UTILITY` pour les huit.** Ce sont des informations sur un dossier existant.
  Un ton promotionnel ferait reclasser en `MARKETING`, qui exige un consentement enregistré
  par destinataire — une complication dont on n'a pas besoin.
- **Ni pied de page, ni bouton.** Les deux sont permis, mais chacun ajoute une règle que
  Meta peut refuser. Pour un premier dépôt, moins de surface = plus de chances d'approbation.
  On pourra ajouter un bouton « Ouvrir » plus tard, sous un nouveau nom.
- **Aucun montant dans aucun modèle.** Un montant qui part chez Meta sort de la plateforme.
  Si tu en veux un, c'est une décision à prendre en connaissance de cause.
- **Aucune donnée de santé**, jamais — règle absolue du hub, et bon sens pour une clinique.

### Si un modèle est refusé

`status: rejected` ou `rejected_by_operator` → le motif est dans `rejection_reason`. Corrige
le texte et redépose **sous le même nom** (le nom n'est bloqué qu'une fois le modèle
approuvé). `category_changed` → Meta l'a classé ailleurs, souvent `MARKETING` : parles-en à
l'administrateur avant de l'utiliser.

---

# Démarche 2 · Le projet Firebase

**Bloque** : S4 uniquement.
**Délai** : une vingtaine de minutes, pas de validation externe.

## Étape 2.1 — Créer le projet

1. <https://console.firebase.google.com> → **Ajouter un projet**. Nom suggéré :
   `poitiers-coworking`.
2. Google Analytics : **inutile**, décline.
3. Dans le projet → icône **Web** (`</>`) → enregistrer une application web. Nom :
   `POITIERS COWORKING`. **Ne coche pas** Firebase Hosting (le frontend est sur Vercel).
4. Firebase affiche l'objet `firebaseConfig`. **Garde cet écran**, les cinq valeurs en
   viennent.

## Étape 2.2 — Activer Cloud Messaging et récupérer la clé VAPID

1. **Paramètres du projet** (roue dentée) → onglet **Cloud Messaging**.
2. Section **Web configuration** → **Web Push certificates** → **Generate key pair**.
3. Copie la **clé publique** affichée. C'est le `VITE_FIREBASE_VAPID_KEY`.

## Étape 2.3 — Créer le compte de service

1. **Paramètres du projet** → onglet **Comptes de service**.
2. **Générer une nouvelle clé privée** → un fichier JSON se télécharge.
3. **Ce fichier est un secret.** Ne le mets ni dans le dépôt, ni dans un message, ni dans le
   frontend. Il donne le droit d'envoyer des notifications au nom de l'application.

## Étape 2.4 — Poser les valeurs

**Les cinq premières sont publiques par conception** — elles partent dans le bundle du
navigateur. Elles vont dans `app/.env.local` (et dans les variables d'environnement Vercel
pour les déploiements) :

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=poitiers-coworking.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=poitiers-coworking
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

**Le compte de service est secret** et va sur le déploiement Convex, sur une seule ligne :

```bash
cd app
npx convex env set -- FIREBASE_SERVICE_ACCOUNT "$(cat ~/Downloads/poitiers-coworking-firebase-adminsdk-xxxxx.json | tr -d '\n')"
```

Puis **supprime le fichier téléchargé**.

> Le `--` est là pour la même raison qu'au §1.2. Et `tr -d '\n'` parce que le JSON est
> multiligne : la clé privée qu'il contient porte des `\n` échappés qui doivent rester tels
> quels, mais le JSON lui-même doit tenir sur une ligne.

## Étape 2.5 — Ouvrir les interrupteurs, au bon moment

Les deux canaux restent **simulés** tant que leur interrupteur est fermé, même avec les clés
posées. C'est voulu : ça permet de recetter sans envoyer.

Dans **Paramètres → Fonctionnement**, à ouvrir seulement quand tu veux des envois réels :

- `whatsappNotifsActive` → notifications WhatsApp réelles
- `pushReelActive` → push système réel

---

# Récapitulatif : qui fait quoi

| | Toi | L'agent |
|---|---|---|
| Contacter l'administrateur du hub | ✅ | — |
| Relire et valider les 8 textes de modèles | ✅ | — |
| Lancer `deposer-modeles.mjs` | ✅ | — |
| Créer le projet Firebase, le compte de service | ✅ | — |
| Poser les variables (`convex env set`, `.env.local`, Vercel) | ✅ | — |
| Ouvrir les interrupteurs quand c'est le moment | ✅ | — |
| Écrire le code qui consomme tout ça | — | ✅ |
| Faire fonctionner S3 et S4 **en simulation** sans aucune de ces valeurs | — | ✅ |

L'agent n'est jamais à l'arrêt : il livre S1, S2, puis S3 et S4 en simulation, et tes valeurs
n'ont qu'à être posées.
