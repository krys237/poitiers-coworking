# S3 · Transport sortant et hub WhatsApp

> **Dépend de** : S1 livré.
> **Modifie le schéma** : oui, une table ajoutée (journal unifié des envois, réutilisée par S4).
> **Dépendance externe** : **oui, bloquante** — modèles WhatsApp à faire approuver par Meta.
> **Référence** : `reference/HUB-WHATSAPP-API.md`, à lire en entier avant de coder.

---

## 1. Objectif

Faire sortir une notification de l'application pour atteindre quelqu'un **qui n'a pas la
plateforme ouverte**, par WhatsApp, via le **hub de notifications interne** de l'entreprise.

Et le faire derrière une **interface de transport remplaçable** : le moteur ne doit connaître
aucun fournisseur. C'est une exigence explicite du propriétaire — le projet a déjà changé de
fournisseur WhatsApp une fois (UltraMsg → hub interne), et `convex/paiePdf.ts` paie
aujourd'hui le prix d'avoir appelé UltraMsg en dur.

### Dans le périmètre

- L'interface `Transport` et son registre de canaux.
- La table du **journal unifié des envois** (WhatsApp et, plus tard, push).
- L'adaptateur du **hub WhatsApp** : envoi, idempotence, reprises, erreurs.
- La route de **retour de statut** (webhook signé) dans `convex/http.ts`.
- Le mode **simulation** sans clé.
- L'interrupteur et les réglages dans Paramètres → Fonctionnement.
- La politique « quel événement part sur WhatsApp ».

### Hors périmètre

- Le push système : c'est S4, qui réutilisera l'interface et le journal de ce lot.
- Les notifications par e-mail : non demandées. L'interface les rendra triviales plus tard.
- La migration du courrier de paie vers l'interface : **voir §10**, à faire en dernier et
  seulement si le reste est stable.
- Tout message **marketing** : hors sujet. Toutes nos notifications sont transactionnelles.

---

## 2. Ce qu'il faut absolument comprendre du hub

Lis `reference/HUB-WHATSAPP-API.md`. Les cinq points qui changent la conception :

1. **Pas de texte libre.** Le hub n'envoie que des **modèles approuvés par Meta**, avec des
   variables numérotées `{{1}}`, `{{2}}`… dans un **ordre** qui compte. On ne peut pas pousser
   le titre d'une notification tel quel. Chaque type d'événement qui doit partir sur WhatsApp
   exige **son modèle approuvé**. C'est la contrainte structurante de ce lot.
2. **`Idempotency-Key` obligatoire, et enregistrée AVANT l'appel.** C'est ce qui permet de
   rejouer sans doublon. Même clé + même contenu → le hub répond `200` avec
   `Idempotent-Replayed: true` et **n'envoie pas deux fois**.
3. **Reprises très encadrées.** On rejoue **uniquement** sur `429`, `5xx`, timeout et erreur
   réseau, **avec la même clé**. Jamais sur `400`, `401`, `403`, `409`, `422`. Un `401`
   rejoué en boucle fait **bannir l'adresse IP** (20 échecs d'authentification en 5 minutes →
   tout est refusé pendant 5 minutes, même avec une clé valide).
4. **Appel depuis une tâche de fond, après le commit.** La documentation du hub l'exige
   explicitement. C'est déjà le patron de S1 : `ctx.scheduler`.
5. **60 envois par minute et par application.** Un rappel quotidien à une quarantaine de
   membres (lot S5) frôle ce plafond. L'étalement est obligatoire — voir §7.

Et une limite à retenir : **le hub ne lit aucune réponse.** Un membre qui répond au message
WhatsApp n'est lu par personne. Les modèles ne doivent donc jamais inviter à répondre ; ils
renvoient vers la plateforme.

---

## 3. L'interface `Transport`

Dans `app/convex/lib/transport.ts` — **pur**, aucun appel réseau, aucun import serveur.

```ts
// Un canal sortant, vu par le moteur de notifications. Le moteur ne connaît AUCUN
// fournisseur : il connaît cette interface. Le hub WhatsApp (S3) et Firebase (S4) en sont
// deux implémentations, remplaçables sans toucher au moteur.
//
// Décision du propriétaire (06/11/2026) : le fournisseur WhatsApp a déjà changé une fois.
// Rien dans le moteur ne doit en dépendre.

export type Canal = "whatsapp" | "push";

/** Mode d'un canal : réel si sa clé est présente ET son interrupteur ouvert. */
export type ModeCanal = "reel" | "simulation";

/** Ce que le moteur demande à un transport d'envoyer. */
export type MessageSortant = {
  canal: Canal;
  destinataireId: string;
  adresse: string;              // numéro +237… pour WhatsApp, jeton d'appareil pour le push
  /** Clé d'idempotence, générée et ENREGISTRÉE avant l'appel. */
  cleIdempotence: string;
  /** Charge utile propre au canal (modèle + paramètres, ou titre + corps). */
  charge: ChargeWhatsapp | ChargePush;
};

export type ChargeWhatsapp = {
  modele: string;               // "poitiers_bon_a_valider"
  langue: string;               // "fr"
  parametres: string[];         // dans l'ORDRE des {{1}}, {{2}}…
  metadonnees?: Record<string, string>;
};

export type ChargePush = { titre: string; corps?: string; lien?: string };

/** Résultat d'un envoi, tel que le journal l'enregistre. */
export type ResultatEnvoi =
  | { issue: "accepte"; messageId?: string }
  | { issue: "simule" }
  | { issue: "echec"; code: string; detail?: string; rejouable: boolean };
```

L'implémentation concrète est une **action Convex** (elle fait du réseau), pas une fonction
pure. Le registre est une simple table de correspondance `canal → action interne`, lue par
l'expéditeur.

---

## 4. Les modèles WhatsApp — à faire approuver AVANT de coder

**Ces textes sont une proposition. Ils doivent être relus et validés par le propriétaire avant
dépôt : un modèle approuvé par Meta n'est pas modifiable, il faut en déposer un nouveau.**

Préfixe de l'application : à confirmer auprès de l'administrateur du hub (proposition :
`poitiers_`). Catégorie : **`UTILITY`** pour tous — ce sont des informations liées à un
dossier existant. Langue : `fr`.

| Modèle | Variables | Corps proposé |
|---|---|---|
| `poitiers_bon_a_valider` | 1 référence, 2 nom | Bonjour, le bon de commande *{{1}}* a été soumis par {{2}} et attend votre validation dans la plateforme. |
| `poitiers_bon_arbitre` | 1 référence, 2 décision, 3 motif | Bonjour, le bon de commande *{{1}}* a été {{2}}. Motif indiqué : {{3}}. Le détail est dans la plateforme. |
| `poitiers_litige_commande` | 1 référence, 2 motif | Bonjour, un litige a été signalé sur le bon de commande *{{1}}*. Motif : {{2}}. Merci de le traiter dans la plateforme. |
| `poitiers_intervention_a_arbitrer` | 1 référence, 2 objet | Bonjour, la demande d'intervention *{{1}}* a été déposée pour : {{2}}. Elle attend un arbitrage dans la plateforme. |
| `poitiers_intervention_suite` | 1 référence, 2 décision | Bonjour, votre demande d'intervention *{{1}}* a été {{2}}. Vous pouvez en consulter le détail dans la plateforme. |
| `poitiers_document_partage` | 1 titre, 2 nom | Bonjour, le document *{{1}}* vous a été partagé par {{2}}. Il est consultable dans la plateforme. |
| `poitiers_rappel_compte_rendu` | 1 date, 2 heure | Bonjour, votre compte rendu du {{1}} n'a pas encore été déposé. Le créneau se ferme à {{2}}. Merci de le renseigner dans la plateforme. |
| `poitiers_dossier_en_attente` | 1 référence, 2 durée | Bonjour, le dossier *{{1}}* attend une décision depuis {{2}}. Merci de le traiter dans la plateforme. |

Les deux derniers servent au lot S5 : **dépose-les en même temps**, la revue Meta prend
jusqu'à 24 h par modèle et S5 serait sinon bloqué à son tour.

### Règles de rédaction imposées par Meta — vérifie avant de déposer

- Corps : 1 024 caractères maximum.
- Une variable n'est **jamais** au début ni à la fin du texte, et **jamais collée** à une
  autre. Toutes les propositions ci-dessus le respectent — si tu les modifies, revérifie.
- Un **exemple réaliste** par variable, sans `#`, `$`, ni `%`.
- Ton strictement informatif. Aucune incitation à acheter, aucun « découvrez nos offres » :
  cela ferait reclasser le modèle en `MARKETING`, qui exige un consentement enregistré.
- Pied de page optionnel, 60 caractères, sans variable.

Dépôt : `POST /template-requests/`. Suivi : `GET /template-requests/{id}/`. Les statuts et
leur signification sont dans `reference/HUB-WHATSAPP-API.md` §5.

### Le repli quand un motif est vide

`poitiers_bon_arbitre` a une variable `motif` que Meta exige non vide. Sur une validation sans
commentaire, envoie **`Aucun motif précisé`** — jamais une chaîne vide, jamais un tiret seul.
Mets ce repli dans la fonction pure de construction des paramètres, et teste-le.

---

## 5. Le schéma — journal unifié des envois

Additif. **Cette table sert aussi au lot S4** : ne la nomme pas « whatsapp ».

```ts
  // ---- Journal des envois de notifications (lot S3, réutilisé par S4) ----
  // Une ligne par tentative d'envoi sortant. La clé d'idempotence est écrite AVANT
  // l'appel au fournisseur : c'est elle qui rend une reprise sûre (exigence du hub).
  envoisNotifications: defineTable({
    notificationId: v.optional(v.id("notifications")),
    destinataireId: v.id("users"),
    canal: v.union(v.literal("whatsapp"), v.literal("push")),
    adresse: v.string(),              // numéro +237…, ou jeton d'appareil
    cleIdempotence: v.string(),       // unique par notification métier
    modele: v.optional(v.string()),   // WhatsApp : nom du modèle Meta
    parametres: v.optional(v.array(v.string())),
    statut: v.union(
      v.literal("a_envoyer"),         // ligne écrite, appel pas encore parti
      v.literal("accepte"),           // hub a accepté (202)
      v.literal("envoye"),
      v.literal("delivre"),
      v.literal("lu"),
      v.literal("echec"),
      v.literal("simule")
    ),
    messageId: v.optional(v.string()),// identifiant rendu par le hub
    codeEchec: v.optional(v.string()),
    erreur: v.optional(v.string()),
    essais: v.number(),
    creeLe: v.string(),
    majLe: v.string(),
  })
    .index("by_cle", ["cleIdempotence"])
    .index("by_notification", ["notificationId"])
    .index("by_message", ["messageId"])
    .index("by_statut_date", ["statut", "creeLe"]),
```

### La clé d'idempotence

Construis-la **stable et lisible**, pour qu'un humain puisse la retrouver dans les logs du
hub :

```
<canal>-<type>-<table>-<idObjet>-<idDestinataire>
→ whatsapp-commande_soumise-commandes-j57abc…-j91def…
```

Elle est **déterministe** : la même notification métier produit toujours la même clé. C'est ce
qui garantit qu'une reprise ne double pas l'envoi, et qu'un redémarrage malheureux non plus.
255 caractères ASCII maximum, sans espace.

Pour un **rappel répété** (lot S5), ajoute le jour : `...-2026-11-12`. Sinon la relance du
lendemain serait considérée comme un doublon de celle de la veille et ne partirait jamais.

---

## 6. Le flux d'envoi

```
notifications.emettre (S1, mutation)
   │  écrit les lignes `notifications`
   └─► scheduler.runAfter(0, internal.envois.preparer)
          │
          ▼
     envois.preparer (internalMutation)
       1. politique : ce type part-il sur WhatsApp ? (§7)
       2. le membre a-t-il un numéro ? préférences ? (S2)
       3. ÉCRIT la ligne `envoisNotifications` en `a_envoyer` avec sa clé
       4. scheduler.runAfter(délai étalé, internal.envois.expedierWhatsapp)
          │
          ▼
     envois.expedierWhatsapp (action, "use node" non requis — fetch suffit)
       5. mode simulation ? → statut `simule`, aucun appel, RIEN n'échoue
       6. POST {hub}/messages/ avec Idempotency-Key
       7. 200/202 → `accepte` + messageId
          429/5xx/réseau → reprise, MÊME clé, attente croissante
          4xx autre → `echec`, code conservé, AUCUNE reprise
          │
          ▼
     http.ts  POST /hooks/whatsapp  (retour de statut, signé)
       8. statut avancé → `envoye` / `delivre` / `lu` / `echec`
```

### Points d'exécution

- **L'ordre des étapes 3 et 4 est non négociable** : la ligne et sa clé sont écrites **avant**
  l'appel. C'est l'exigence du hub, et c'est ce qui rend la reprise sûre.
- `expedierWhatsapp` est une **action** : elle fait du réseau, donc elle n'a pas `ctx.db`.
  Elle lit et écrit par `ctx.runQuery` / `ctx.runMutation` sur des fonctions `internal.*`.
- Timeout HTTP : **10 s** (`AbortSignal.timeout(10_000)`).
- Reprises : 2 s, 5 s, 15 s, 60 s, puis abandon en `echec` avec le code
  `max_essais_locaux`. Compte les tentatives dans `essais`. Replanifie avec
  `ctx.scheduler.runAfter`, ne boucle **jamais** dans l'action.
- **Ne journalise jamais l'en-tête `Authorization`.** Masque-le si tu traces la requête.
- Conserve le `request_id` du hub dans `erreur` sur un échec : c'est ce que le support
  demandera.

### Les codes d'échec qu'il faut traiter à part

| Code | Conduite |
|---|---|
| `131026` | Numéro sans WhatsApp. Marque le numéro comme douteux dans le journal ; ne relance pas. |
| `recipient_opted_out`, `131049`, `131050` | **Ne jamais contourner, ne jamais relancer.** |
| `template_not_available`, `132001`, `132015` | Problème de configuration : échec définitif, et c'est au propriétaire de voir l'administrateur du hub. |
| `invalid_template_parameters` (422) | **Bug d'intégration chez nous.** Échec définitif. Les paramètres ne correspondent pas au modèle : c'est un test qui manquait. |
| `not_authenticated` (401) | Échec définitif, **aucune reprise** (risque de bannissement IP). Le propriétaire doit être alerté : clé absente, erronée, révoquée ou expirée. |

---

## 7. La politique : quel événement part sur WhatsApp

**Pas tout.** WhatsApp est facturé au message, plafonné à 60 par minute, et un canal qui
sonne pour tout n'est plus regardé.

Règle par défaut, à déclarer dans `lib/notifications.ts` en ajoutant un champ au catalogue
de S1 :

```ts
  /** Ce type sort-il de l'application, et par quels canaux ? */
  canaux?: Canal[];
  /** Modèle WhatsApp et construction de ses paramètres, si le type part sur WhatsApp. */
  whatsapp?: { modele: string; parametres: (c: ContexteRendu) => string[] };
```

Partent sur WhatsApp **uniquement** les types dont l'importance est `a_traiter` ou `urgent`
**et** qui attendent une action de quelqu'un :

| Type | WhatsApp | Pourquoi |
|---|---|---|
| `commande_soumise` | **oui** | quelqu'un doit arbitrer |
| `commande_rejetee` | **oui** | le demandeur doit corriger |
| `commande_litige` | **oui** | urgent |
| `intervention_creee` | **oui** | quelqu'un doit arbitrer |
| `intervention_arbitree` | **oui** | le demandeur attend la réponse |
| `document_adresse` | **oui** | adressé nominativement |
| `compte_en_attente` | non | la Direction le verra à sa prochaine connexion |
| `commande_validee` | non | information |
| `commande_commentaire` | non | trop fréquent, ferait du bruit |
| `intervention_commentaire` | non | idem |
| `intervention_cloturee` | non | information |
| `cr_remarque` | non | se lit avec le compte rendu |
| `cr_valide` | non | information |

**L'étalement.** `preparer` planifie l'expédition avec un décalage croissant : `runAfter(i * 1200 ms)`
pour le i-ème destinataire d'un même événement. À 50 envois par minute maximum, on reste sous
le plafond du hub même en pleine rafale. **Ne lance jamais une rafale sans décalage.**

### WhatsApp est le filet de sécurité des appareils sans push

Une règle à implémenter **dès ce lot**, même si S4 n'existe pas encore.

Sur iPhone, le push système n'arrive **que si la PWA est installée sur l'écran d'accueil**
(limite d'Apple, voir `S4-FIREBASE-PUSH.md` §5). Beaucoup de membres ne l'installeront jamais.
Pour eux, le push ne remplacera donc jamais rien : **WhatsApp est leur seul canal hors
application.**

Conséquence sur la politique : pour un type `a_traiter` ou `urgent`, l'envoi WhatsApp **n'est
jamais désactivé au motif que le push existe**. Les deux canaux sont indépendants, et aucun ne
sert de repli conditionnel à l'autre.

Écris cette règle dans une fonction pure `canauxPour(type, membre)` de
`lib/notifications.ts` :

```ts
// Les canaux ne se substituent pas l'un à l'autre : un membre sans appareil capable de
// recevoir un push (iPhone sans PWA installée, navigateur ayant refusé la permission)
// n'aurait plus AUCUN canal hors application si WhatsApp dépendait de l'absence de push.
// D'où la règle : WhatsApp part selon le type et les préférences, jamais selon les appareils.
```

En S3, `membre` n'est pas encore utilisé — mais la signature est en place, et S4 n'aura rien à
rouvrir. C'est aussi ce qui permettra au propriétaire, plus tard, de décider d'économiser des
messages WhatsApp pour les membres réellement joignables en push : ce sera un **réglage**, pas
une réécriture.

### Interrupteur et réglages

Ajoute dans `convex/lib/reglages.ts` (et à `REGLAGES_DEFAUT`, à **`false`**) :

```ts
  /** Notifications WhatsApp : sans cet interrupteur, l'envoi reste simulé même si la clé du hub est définie. */
  whatsappNotifsActive: boolean;
```

Mode réel **si et seulement si** `process.env.NOTIFICATION_HUB_API_KEY` est présent **et**
`whatsappNotifsActive` est vrai. Sinon : `simule`, aucun appel, **rien n'échoue**. C'est le
patron de la maison (`convex/paiePdf.ts`).

Variables à poser sur le déploiement Convex (`npx convex env set`, **jamais** dans
`app/.env.local` qui n'est pas vu par les fonctions) :

```
NOTIFICATION_HUB_URL=https://notifications.edoctor-tim.com/api/v1
NOTIFICATION_HUB_API_KEY=nhk_<prefixe>_<secret>
NOTIFICATION_HUB_CALLBACK_SECRET=whsec_<secret>      # si les retours de statut sont activés
```

Expose l'état de ces variables dans Paramètres → Déploiement (`parametres.etatDeploiement`),
qui dit **si** une variable est définie et **jamais** sa valeur.

---

## 8. Le retour de statut (webhook)

Route `POST /hooks/whatsapp` dans `convex/http.ts`, à côté de l'API financière existante.

L'ordre des opérations est imposé par la sécurité :

1. **Lire le corps BRUT** (`await request.text()`) **avant tout décodage JSON**.
2. **Vérifier la signature** : `sha256=` + HMAC-SHA256 du message
   `` `${timestamp}.` + corpsBrut ``, clé `NOTIFICATION_HUB_CALLBACK_SECRET`, **comparaison en
   temps constant**. Signature invalide → `401`, et on s'arrête là.
3. **Refuser un horodatage de plus de 5 minutes** (`X-Hub-Timestamp`, secondes Unix) :
   protection contre le rejeu.
4. **Répondre `200` en moins de 10 s**, et traiter par `ctx.runMutation`. Toute autre réponse
   déclenche des reprises du hub pendant ~24 h.
5. **Ne pas supposer l'ordre d'arrivée** : `delivered` peut arriver après `read`. Conserve
   toujours le **statut le plus avancé** (`accepte` < `envoye` < `delivre` < `lu` ; `echec`
   est final).

> Le point 5 règle aussi le dédoublonnage : garder le statut le plus avancé rend le traitement
> **naturellement idempotent**. Il n'y a donc pas besoin de stocker les `X-Hub-Delivery`
> déjà vus. C'est plus simple et c'est plus sûr.

Convex fournit le corps brut via `request.text()` — pas de middleware à configurer. Rappel :
`httpAction` n'a **pas** de `ctx.db`, tout passe par `internal.*`.

Si le propriétaire n'active pas les retours de statut, le lot reste fonctionnel : les envois
restent au statut `accepte`. Dans ce cas, **n'implémente pas de scrutation périodique** —
c'est 300 requêtes/minute de budget dépensé pour une information dont personne ne se sert
encore.

---

## 9. Tests

Nouvelle suite `app/tests/transportWhatsapp.test.ts`, script `test:transport`. Tout est
testable **sans réseau**, parce que la construction du message est pure :

| # | Cas | Attendu |
|---|---|---|
| 1 | Construction des paramètres des 8 modèles | nombre et ordre exacts attendus par chaque modèle |
| 2 | Motif vide sur `poitiers_bon_arbitre` | `Aucun motif précisé`, jamais une chaîne vide |
| 3 | Clé d'idempotence | déterministe, ASCII, sans espace, ≤ 255 caractères |
| 4 | Clé d'un rappel répété | **diffère d'un jour à l'autre** |
| 5 | Politique de canal | les 13 types donnent exactement la table du §7 |
| 6 | Classement des codes d'échec | `429`/`5xx` rejouables ; `401`/`403`/`409`/`422` **non** |
| 7 | Mode du canal | clé absente → `simulation` ; clé présente + interrupteur fermé → `simulation` ; les deux → `reel` |
| 8 | Étalement | le i-ème destinataire est décalé de `i × 1200 ms` |
| 9 | Monotonie des statuts | `lu` reçu puis `delivre` → le statut reste `lu` |
| 10 | Vérification de signature | un corps modifié d'un octet est refusé |

Le cas 1 est le plus important : un `invalid_template_parameters` en production est un test
manquant.

---

## 10. Le courrier de paie reste sur UltraMsg — et ce n'est pas un oubli

`convex/paiePdf.ts` appelle UltraMsg **en dur** (`envoyerWhatsapp`, ligne ~233) pour envoyer
les bulletins, avec le **PDF en pièce jointe**. C'est exactement ce que l'interface
`Transport` est censée empêcher, et on pourrait croire qu'il suffit de substituer l'appel.

**Non. Le hub ne sait pas envoyer de document.** Vérifié dans tout le contrat d'API
(`reference/HUB-WHATSAPP-API.md`) : les modèles n'acceptent qu'un `header` **texte** de
60 caractères, un `body`, un `footer` et des boutons ; les paramètres d'envoi sont
exclusivement `{"type": "text", "text": "…"}`. Aucun type `document`, `image` ou `media`
n'existe. Le §13 confirme par ailleurs que les messages libres ne sont pas supportés.

**Donc : ne migre pas le courrier de paie dans ce lot, ni dans aucun autre, en l'état.** Il
continue de fonctionner par UltraMsg. Il n'est pas cassé, et le laisser est la bonne décision
tant que le hub ne porte pas de document.

### Ce qui est faisable, et qui tranche

Trois options, toutes à l'arbitrage du **propriétaire** — tu ne choisis pas à sa place :

1. **Statu quo** : le bulletin part par UltraMsg (WhatsApp, PDF joint) et par Resend
   (e-mail, PDF joint). Les notifications passent par le hub. Deux fournisseurs WhatsApp
   coexistent — inélégant, mais ça fonctionne et ça ne coûte rien.
2. **Demander au hub de porter les documents.** La question a été posée à l'administrateur
   (voir `DEMARCHES-EXTERNES.md` §1.1). Si la réponse est oui, la migration redevient une
   substitution d'appel derrière l'interface `Transport`, et UltraMsg disparaît.
3. **Un modèle de notification + l'e-mail pour le PDF** : le hub envoie « votre bulletin de
   *{{1}}* est disponible », et le PDF part par Resend, qui marche déjà. Cela supprime
   UltraMsg sans attendre le hub, **mais** prive du bulletin les employés sans e-mail — et
   beaucoup n'en ont pas, c'est précisément la raison d'être du canal WhatsApp
   (décision du 13/10/2026). À ne retenir que si le propriétaire l'accepte en connaissance de
   cause.

**Ce que tu fais** : rien sur `paiePdf.ts`, et tu signales ce point au propriétaire avec ces
trois options quand tu livres S3.

---

## 11. Risques

| Risque | Parade |
|---|---|
| Un modèle non approuvé → tout le lot attend | Dépose les 8 modèles **dès le début du programme**, avant de coder S3. |
| Un double envoi | Clé d'idempotence déterministe, écrite **avant** l'appel. Ne génère jamais une clé neuve pour « réessayer ». |
| Un `401` rejoué en boucle → IP bannie | Aucune reprise sur `401`. C'est écrit dans le code **et** testé (cas 6). |
| Le plafond de 60/minute dépassé par un rappel de masse | Étalement à 1 200 ms, testé (cas 8). |
| Une donnée de santé qui part chez Meta | Aucun de nos modèles n'en porte. Mais la règle est absolue : **jamais de donnée de santé, jamais de secret** dans les variables ni dans `metadata`. |
| La clé dans un log ou un commit | Masque `Authorization`. Les variables se posent par `npx convex env set`. |
| Un montant envoyé hors de la plateforme | Aucun modèle proposé ne contient de montant. Si le propriétaire en demande un, qu'il le décide en connaissance de cause. |
