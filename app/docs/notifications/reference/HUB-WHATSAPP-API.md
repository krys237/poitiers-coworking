**Sommaire**[1. Principe](#1-principe)[2. Ce que vous recevez de l'administrateur du hub](#2-ce-que-vous-recevez-de-ladministrateur-du-hub)[3. Configuration côté application](#3-configuration-cote-application)[4. Authentification](#4-authentification)[5. Connaître les modèles disponibles](#5-connaitre-les-modeles-disponibles)[6. Envoyer une notification](#6-envoyer-une-notification)[7. Idempotence : ne jamais envoyer deux fois](#7-idempotence-ne-jamais-envoyer-deux-fois)[8. Suivre le statut d'un message](#8-suivre-le-statut-dun-message)[9. Erreurs et conduite à tenir](#9-erreurs-et-conduite-a-tenir)[10. Limites](#10-limites)[11. Exemples de code](#11-exemples-de-code)[12. Checklist de mise en production](#12-checklist-de-mise-en-production)[13. Hors périmètre aujourd'hui](#13-hors-perimetre-aujourdhui)[14. Support](#14-support)

# Guide d'intégration — Hub de notifications WhatsApp

Destiné aux équipes des applications internes (DMI, TeleConsultation, …) qui doivent envoyer des notifications WhatsApp. Ce guide décrit **tout ce qu'il faut faire côté application**.

## 1. Principe

```
Votre backend ──HTTPS + clé API──► Hub de notifications ──► WhatsApp Cloud API (Meta) ──► destinataire
                                         ▲
                         statuts (envoyé, délivré, lu) remontés par Meta
```

- Votre application **ne parle jamais à Meta**. Elle ne détient aucun token Meta, aucun identifiant de numéro, aucun App Secret. Elle appelle uniquement le hub.
- Tous les messages partent du **numéro WhatsApp central** de l'entreprise. Vous ne choisissez pas l'expéditeur.
- Seuls des **modèles (templates) approuvés par Meta** et autorisés pour votre application peuvent être envoyés. Pas de texte libre.
- L'envoi est **asynchrone** : le hub enregistre votre demande, répond immédiatement, puis l'envoie à Meta. Vous suivez ensuite le statut.
- Chaque application ne voit que **ses propres messages**.

## 2. Ce que vous recevez de l'administrateur du hub

| Élément | Exemple | Remarque |
| --- | --- | --- |
| URL de base | `https://notifications.edoctor-tim.com/api/v1/` | Identique pour toutes les applications |
| Identifiant d'application | `dmi` | Pour le support et les logs |
| Clé API | `nhk_3f9a1c0b7e2d_…` | **Secret.** Transmise une seule fois par un canal sûr |
| Modèles autorisés | `dmi_doctor_kyc_reminder`, … | Consultables à tout moment via `GET /templates/` |

Pour obtenir l'accès, demandez à l'administrateur du hub : le nom de votre application, la liste des modèles WhatsApp dont vous avez besoin, et un contact technique.

## 3. Configuration côté application

Deux variables d'environnement suffisent :

```bash
NOTIFICATION_HUB_URL=https://notifications.edoctor-tim.com/api/v1
NOTIFICATION_HUB_API_KEY=nhk_<préfixe>_<secret>
```

Règles sur la clé :

- Stockée dans les variables d'environnement ou un coffre de secrets, **jamais** dans le code, dans git, dans une application mobile ou dans un frontend web.
- Utilisée **uniquement depuis votre backend**.
- Jamais écrite dans vos logs (masquez l'en-tête `Authorization`).
- Une clé par application : ne la partagez pas avec une autre application.
- En cas de fuite supposée, prévenez immédiatement l'administrateur du hub : elle sera révoquée et remplacée.

## 4. Authentification

Chaque requête porte l'en-tête :

```
Authorization: Bearer nhk_<préfixe>_<secret>
```

Vérifiez votre configuration avec :

```bash
curl -sS -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" "$NOTIFICATION_HUB_URL/me/"
```

```json
{
  "application": {"id": "…", "name": "DMI", "client_id": "dmi", "status": "active"},
  "credential": {"key_prefix": "3f9a1c0b7e2d", "name": "prod",
                 "scopes": ["messages:send", "messages:read", "templates:read"], "expires_at": "2027-11-05T…"}
}
```

Surveillez `expires_at` : une clé expirée est refusée. Demandez la nouvelle clé **avant** l'échéance (la rotation se fait sans interruption : nouvelle clé déployée, puis ancienne révoquée).

> **Attention** : après 20 échecs d'authentification en 5 minutes depuis une même adresse IP, **toutes** les requêtes de cette IP sont refusées (429) pendant 5 minutes, même avec une clé valide. Ne relancez jamais en boucle une requête qui reçoit 401.

## 5. Connaître les modèles disponibles

```bash
curl -sS -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" "$NOTIFICATION_HUB_URL/templates/"
```

```json
[
  {
    "name": "dmi_doctor_kyc_reminder",
    "language": "fr",
    "category": "UTILITY",
    "parameters": {"components": [
      {"type": "body", "parameters": [
        {"type": "text", "label": "{{1}}", "example": "10/12/2025"},
        {"type": "text", "label": "{{2}}", "example": "15"}
      ]}
    ]}
  }
]
```

- Seuls les modèles **autorisés pour votre application et envoyables** sont listés.
- `parameters` indique, dans l'ordre, les variables attendues par composant : les variables `{{1}}`, `{{2}}`… du texte du modèle. `label` et `example` (valeur d'exemple déclarée à Meta) ne sont qu'une aide de lecture ; c'est **l'ordre** qui compte. `max_length`, s'il est présent, est la longueur maximale acceptée par le hub.
- Un modèle sans variable a `{"components": []}`.

### Proposer un nouveau modèle

Vous fournissez seulement le texte ; le hub vérifie les règles de Meta, l'administrateur valide, puis le hub soumet le modèle à Meta et vous l'autorise dès son approbation.

Prérequis : l'administrateur a configuré le **préfixe** de votre application (ex. `dmi_`) et votre clé a le scope `templates:write`.

```bash
curl -sS -X POST "$NOTIFICATION_HUB_URL/template-requests/" \
  -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "name": "dmi_trial_end_notice",
    "language": "fr",
    "category": "UTILITY",
    "header": {"text": "Rappel"},
    "body": {
      "text": "Bonjour, votre période d'\''essai se termine le *{{1}}*. Vous pouvez consulter votre abonnement dans l'\''application.",
      "examples": ["30/11/2026"]
    },
    "footer": {"text": "support@edoctor-tim.com"},
    "buttons": [
      {"type": "URL", "text": "Mon compte", "url": "https://edoctor-tim.com/compte/{{1}}", "examples": ["abc123"]}
    ]
  }'
# → 201 {"id": "…", "status": "pending_review", …}
```

| Champ | Règle |
| --- | --- |
| `name` | Minuscules, chiffres, `_`, commence par votre préfixe. Unique par langue. |
| `category` | `UTILITY` (information liée au compte, à une commande, à un rendez-vous), `MARKETING` (promotion, offre, annonce) ou `AUTHENTICATION` (code OTP). |
| `header` (optionnel) | Texte de 60 caractères max, une variable au plus, sans `*` `_` `~`. |
| `body` | 1024 caractères max. Variables `{{1}}`, `{{2}}`… dans l'ordre, **jamais au début ni à la fin du texte, jamais collées**, un exemple réaliste par variable (sans `#`, `$`, `%`). |
| `footer` (optionnel) | 60 caractères max, sans variable. |
| `buttons` (optionnel) | `QUICK_REPLY` (`text`), `URL` (`text`, `url` en `https://`, variable `{{1}}` seulement en fin d'URL avec `examples`), `PHONE_NUMBER` (`text`, `phone_number`). 10 au total, 2 URL, 1 téléphone, texte de 25 caractères max. |
| `authentication` | Pour `AUTHENTICATION` uniquement (le texte est imposé par Meta) : `{"code_expiration_minutes": 10, "add_security_recommendation": true, "button_text": "Copier le code"}`. |

Si le texte ne respecte pas une règle : `422 invalid_template_request`, avec **tous** les problèmes dans `error.details`. Nom déjà utilisé : `409 template_name_taken`.

**Suivre la demande** : `GET /template-requests/{id}/` (ou la liste `GET /template-requests/`).

| `status` | Signification |
| --- | --- |
| `pending_review` | En attente de validation par l'administrateur du hub |
| `rejected_by_operator` | Refusée par l'administrateur (motif dans `rejection_reason`) ; corrigez et reproposez |
| `submitting` / `submitted` | Envoyée à Meta, en cours de revue (jusqu'à 24 h) |
| `submission_failed` | Refusée par l'API Meta à l'envoi (motif dans `rejection_reason`) |
| `approved` | **Approuvée** : le modèle apparaît dans `GET /templates/` et peut être envoyé |
| `category_changed` | Meta l'a approuvée dans une autre catégorie (souvent MARKETING) ; l'administrateur décide de son usage |
| `rejected` | Refusée par Meta (motif dans `rejection_reason`) ; corrigez et reproposez |

Conseils pour être approuvé en `UTILITY` : un ton strictement informatif, lié à une action ou à un compte existant de l'utilisateur, sans incitation à acheter ni « découvrez nos offres ».

## 6. Envoyer une notification

```
POST /messages/
Authorization: Bearer nhk_…
Idempotency-Key: <identifiant unique de la demande>
Content-Type: application/json
```

```json
{
  "recipient": "+237690123456",
  "template": "dmi_doctor_kyc_reminder",
  "language": "fr",
  "components": [
    {"type": "body", "parameters": [
      {"type": "text", "text": "04/12/2026"},
      {"type": "text", "text": "30"}
    ]}
  ],
  "metadata": {"doctor_id": "D-1042", "event": "kyc_reminder"}
}
```

| Champ | Obligatoire | Règle |
| --- | --- | --- |
| `recipient` | oui | Format international : `+237…`, `00237…` ou `237…`. Espaces et tirets acceptés. **Aucun indicatif n'est deviné** : `690123456` seul est refusé. |
| `template` | oui | Nom exact du modèle (voir `GET /templates/`). |
| `language` | oui | Langue du modèle, ex. `fr`. |
| `components` | si le modèle a des variables | Même structure et même ordre que `parameters` du modèle. Chaque valeur : `{"type": "text", "text": "…"}`. |
| `metadata` | non | Vos références (10 clés max, clés `[A-Za-z0-9_.-]` de 64 caractères, valeurs texte de 255 caractères). Renvoyées telles quelles à la consultation. |

**Réponse `202 Accepted`** :

```json
{
  "id": "f07dd895-6c1e-4a51-9b0e-2d1f7c3a8e44",
  "status": "queued",
  "channel": "whatsapp",
  "created_at": "2026-11-05T09:12:44.120Z",
  "status_url": "https://notifications.edoctor-tim.com/api/v1/messages/f07dd895-…/"
}
```

`202` signifie **« demande enregistrée par le hub »**, pas « message reçu par le destinataire ». Conservez l'`id` dans votre base, associé à votre objet métier.

### Codes à usage unique (OTP)

Les modèles de catégorie AUTHENTICATION (ex. `dmi_otp_activation_account`, `dmi_otp_password_reset`) s'envoient par le hub comme les autres, avec deux particularités.

**Le même code est passé deux fois** : dans le corps (`{{1}}`) et dans le bouton « Copier le code » (bouton URL d'index 0). `GET /templates/` le montre :

```json
{"components": [
  {"type": "body", "parameters": [{"type": "text", "label": "{{1}}", "example": "123456"}]},
  {"type": "button", "sub_type": "url", "index": 0, "parameters": [{"type": "text", "label": "{{1}}"}]}
]}
```

```json
{
  "recipient": "+237655362943",
  "template": "dmi_otp_activation_account",
  "language": "fr",
  "components": [
    {"type": "body", "parameters": [{"type": "text", "text": "483920"}]},
    {"type": "button", "sub_type": "url", "index": 0, "parameters": [{"type": "text", "text": "483920"}]}
  ],
  "metadata": {"purpose": "account_activation"}
}
```

Oublier le paramètre du bouton est refusé par le hub (`422 invalid_template_parameters`), avant même d'atteindre Meta.

**Le code expire** : le hub ne transmet jamais un code plus de **10 minutes** après votre demande. Passé ce délai, le message passe en `failed` avec `failure.code = "expired"`. Côté Meta, un message non délivré est aussi abandonné au bout de 10 minutes.

Ce qui reste **dans votre application** (le hub ne fait que transporter le message) :

- générer le code (aléatoire cryptographique), n'en conserver que le hachage, avec son usage (`account_activation` / `password_reset`) et son expiration ;
- vérifier le code (nombre d'essais limité, usage unique, comparaison en temps constant) ;
- limiter les demandes de code par numéro et par IP ;
- choisir le modèle selon l'usage : le client mobile envoie un usage, jamais un nom de modèle.

Pour chaque code, utilisez une **nouvelle** `Idempotency-Key` (ex. `otp-<id du code>`). Pour renvoyer un code (« Renvoyer »), générez un **nouveau code** et une nouvelle clé, ne rejouez pas l'ancienne requête.

Côté hub, le code n'est conservé en clair que le temps de l'envoi, puis effacé ; il n'est jamais affiché ni renvoyé par l'API. Ne le mettez **jamais** dans `metadata`.

**Liens d'activation** : les modèles `dmi_account_activation_*` contiennent un lien avec jeton. L'administrateur du hub les marque « variables sensibles » : même effacement après l'envoi, sans échéance.

### Messages marketing (promotions, abonnements, annonces)

Les modèles de catégorie MARKETING (ex. `dmi_subscription_*`, `dmi_outreach_practitioner_broadcast`) ne sont envoyables que si :

1. **votre application est autorisée au marketing** : à demander à l'administrateur du hub ;
2. **le destinataire a donné son consentement**, et votre application l'a enregistré dans le hub. Meta l'exige pour tout message promotionnel.

**Enregistrer le consentement** quand l'utilisateur coche la case (inscription, paramètres du compte…) :

```bash
curl -sS -X POST "$NOTIFICATION_HUB_URL/marketing-consents/" \
  -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" -H "Content-Type: application/json" \
  -d '{"recipient": "+237655362943", "source": "inscription-case-v2"}'
# → 200 {"recipient": "2376******43", "status": "granted"}
```

**Le retirer** dès que l'utilisateur se désabonne :

```bash
curl -sS -X POST "$NOTIFICATION_HUB_URL/marketing-consents/revoke/" \
  -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" -H "Content-Type: application/json" \
  -d '{"recipient": "+237655362943", "source": "parametres-compte"}'
# → 200 {"recipient": "2376******43", "status": "revoked"}
```

- `source` décrit **comment** le consentement a été recueilli ou retiré (texte libre, 255 caractères) : c'est la preuve conservée par le hub. Versionnez-le si le texte de la case change (`inscription-case-v2`).
- Les deux appels sont idempotents. `revoke` est toujours accepté.
- Le consentement vaut pour le numéro WhatsApp de l'entreprise, donc pour toutes les applications autorisées au marketing.
- La clé API doit avoir le scope `consents:write` (inclus par défaut dans les clés récentes).
- Un utilisateur qui répond « STOP » sur WhatsApp **n'est pas désabonné automatiquement** : le hub ne lit pas les réponses. Proposez le désabonnement dans votre application.

Sans consentement actif, l'envoi est refusé (`422 marketing_consent_required`). Si le consentement est retiré entre la demande et l'envoi, le message passe en `failed` (`marketing_consent_revoked`) sans être envoyé.

Les messages marketing sont envoyés **à un débit limité** (5/s au maximum pour l'ensemble des applications), après les notifications transactionnelles et les OTP. Meta limite aussi le nombre de messages marketing qu'un utilisateur reçoit : un `failed` avec le code `131049` est normal, ne le réessayez pas.

### Données à ne pas envoyer

- **Aucune donnée de santé** (diagnostic, traitement, résultat d'examen…) dans `metadata` ni dans les variables, sauf si le texte du modèle approuvé l'exige explicitement.
- Aucun mot de passe, aucun token, aucun code secret dans `metadata`.

## 7. Idempotence : ne jamais envoyer deux fois

L'en-tête `Idempotency-Key` est **obligatoire**. C'est ce qui vous permet de rejouer une requête sans risque de doublon.

- Générez **une clé par notification métier** (un UUID, ou une référence stable comme `kyc-reminder-D1042-2026-11-05`), 255 caractères ASCII maximum, sans espace.
- **Enregistrez-la avant d'appeler le hub**, avec votre objet métier.
- En cas de doute (timeout, coupure réseau, erreur 5xx) : **rejouez exactement la même requête avec la même clé**.

| Situation | Réponse |
| --- | --- |
| Même clé, même contenu, déjà acceptée | `200` + en-tête `Idempotent-Replayed: true`, même `id`, **aucun second envoi** |
| Même clé, contenu différent | `409 idempotency_key_conflict` |
| Demande précédemment refusée (400/422) | Non mémorisée : corrigez et renvoyez avec la même clé |

Ne générez **jamais** une nouvelle clé pour « réessayer » : vous risqueriez un double envoi.

## 8. Suivre le statut d'un message

```bash
curl -sS -H "Authorization: Bearer $NOTIFICATION_HUB_API_KEY" "$NOTIFICATION_HUB_URL/messages/<id>/"
```

```json
{
  "id": "f07dd895-…",
  "status": "delivered",
  "channel": "whatsapp",
  "recipient": "2376******56",
  "template": {"name": "dmi_doctor_kyc_reminder", "language": "fr"},
  "metadata": {"doctor_id": "D-1042", "event": "kyc_reminder"},
  "idempotency_key": "kyc-reminder-D1042-2026-11-05",
  "created_at": "…", "updated_at": "…",
  "accepted_at": "…", "sent_at": "…", "delivered_at": "…", "read_at": null, "failed_at": null,
  "failure": null
}
```

| Statut | Signification | Final ? |
| --- | --- | --- |
| `queued` | Demande enregistrée, en attente d'envoi | non |
| `processing` | En cours d'envoi à Meta | non |
| `accepted_by_provider` | Meta a accepté le message (pas encore une preuve de livraison) | non |
| `sent` | Parti vers le téléphone du destinataire | non |
| `delivered` | Reçu sur le téléphone | non (peut passer à `read`) |
| `read` | Lu (seulement si le destinataire a activé les confirmations de lecture) | **oui** |
| `failed` | Échec définitif ; la cause est dans `failure` | **oui** |
| `unknown` | Résultat ambigu côté Meta ; le hub **ne renvoie pas** automatiquement | voir ci-dessous |

- Le hub peut **prévenir votre application** à chaque changement (voir « Être prévenu automatiquement » plus bas) ; sinon, consultez le statut.
- Stratégie conseillée : consulter après 5 s, 30 s, 2 min, 10 min, puis s'arrêter quand le statut est `delivered`, `read` ou `failed`, ou après 24 h. Beaucoup d'applications n'ont besoin que de détecter les `failed`.
- Pour un suivi groupé : `GET /messages/?status=failed&created_after=2026-11-05T00:00:00Z` (pagination par curseur : suivre `next` ; `page_size` jusqu'à 100). Autres filtres : `created_before`, `idempotency_key`.
- Le numéro du destinataire est toujours renvoyé **masqué**.

**`failure.code` courants** :

| Code | Cause | Action |
| --- | --- | --- |
| `131026` | Numéro sans WhatsApp ou injoignable | Vérifier le numéro auprès de l'utilisateur |
| `132000` | Nombre de variables différent de celui du modèle Meta | Signaler à l'administrateur du hub |
| `132001` / `132015` | Modèle inexistant, ou mis en pause par Meta | Signaler à l'administrateur du hub |
| `131049`, `131050` | Meta a limité ou l'utilisateur a bloqué les messages d'entreprise | Ne pas insister |
| `recipient_opted_out` | Numéro ajouté à la liste d'exclusion entre la demande et l'envoi | Ne pas renvoyer |
| `template_not_available` | Modèle désactivé entre la demande et l'envoi | Signaler à l'administrateur |
| `expired` | Code OTP non transmis dans les 10 minutes suivant la demande | Proposer à l'utilisateur un nouveau code |
| `marketing_consent_revoked` | Consentement marketing retiré avant l'envoi | Ne pas renvoyer |
| `marketing_not_enabled` | Marketing désactivé pour votre application avant l'envoi | Voir l'administrateur |
| `max_attempts_exceeded` | Meta indisponible trop longtemps | Renvoyer plus tard avec une **nouvelle** clé |
| `operator_marked_failed` | Message `unknown` clôturé par l'administrateur | Renvoyer avec une **nouvelle** clé si nécessaire |

**Message `unknown`** : le hub ne sait pas si Meta l'a reçu. Il ne le renvoie jamais seul, pour ne pas créer de doublon. Il se met à jour tout seul si Meta envoie un statut ; sinon l'administrateur le passe en `failed` (`operator_marked_failed`) et vous pouvez alors le renvoyer avec une nouvelle `Idempotency-Key`.

### Être prévenu automatiquement (notifications du hub)

Plutôt que d'interroger `GET /messages/{id}/`, votre application peut **recevoir** les changements. Demandez à l'administrateur du hub de configurer :

- votre **URL de rappel** (`https://…`, joignable depuis Internet) ;
- les **événements** voulus : `message.delivered`, `message.read`, `message.failed`, `message.unknown`, `template_request.decided` (par défaut), `message.sent` (en option) ;
- le **secret de signature** `whsec_…`, qu'il vous transmet par un canal sûr. Stockez-le dans `NOTIFICATION_HUB_CALLBACK_SECRET`, comme la clé API.

Le hub envoie un `POST` JSON :

```
POST /hooks/whatsapp
Content-Type: application/json
X-Hub-Event: message.failed
X-Hub-Delivery: 7c0d0f6e-…          ← identifiant unique de la notification
X-Hub-Timestamp: 1794400000         ← secondes Unix
X-Hub-Signature-256: sha256=5f1c…
```

```json
{
  "id": "7c0d0f6e-…",
  "type": "message.failed",
  "created_at": "2026-11-11T09:12:44.120Z",
  "data": {
    "message_id": "f07dd895-…",
    "status": "failed",
    "occurred_at": "2026-11-11T09:12:43Z",
    "idempotency_key": "kyc-reminder-D1042-2026-11-11",
    "recipient": "2376******56",
    "template": {"name": "dmi_doctor_kyc_reminder", "language": "fr"},
    "metadata": {"doctor_id": "D-1042"},
    "failure": {"code": "131026", "detail": "…"}
  }
}
```

Pour `template_request.decided`, `data` contient `template_request_id`, `name`, `language`, `category`, `status` (`approved`, `rejected`, `category_changed`, `rejected_by_operator`), `meta_category` et `rejection_reason`. Un événement `ping` sert au test de l'URL.

**Ce que votre endpoint doit faire** :

1. **Vérifier la signature** sur le **corps brut** (avant tout décodage JSON), avec une comparaison en temps constant, et refuser (401) si elle ne correspond pas.
2. **Refuser un horodatage trop ancien** (ex. plus de 5 minutes) : protection contre le rejeu.
3. **Dédoublonner** avec `X-Hub-Delivery` : une notification peut arriver plusieurs fois.
4. **Répondre 2xx vite** (moins de 10 s) et traiter ensuite en tâche de fond. Toute autre réponse, ou pas de réponse, déclenche un nouvel essai : 30 s, 2 min, 10 min, 30 min, 1 h, 3 h, 6 h, 12 h, puis abandon (\~24 h).
5. **Ne pas supposer l'ordre** : `delivered` peut arriver après `read`. Gardez le statut le plus avancé (`sent` \< `delivered` \< `read` ; `failed` est final).

Python (Django ou Flask, sur le corps brut) :

```python
import hashlib, hmac, os, time

SECRET = os.environ["NOTIFICATION_HUB_CALLBACK_SECRET"].encode()

def verify(headers, raw_body: bytes) -> bool:
    timestamp = headers.get("X-Hub-Timestamp", "")
    signature = headers.get("X-Hub-Signature-256", "")
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > 300:
        return False
    expected = "sha256=" + hmac.new(SECRET, f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

Node.js (Express : `express.raw({ type: "application/json" })` sur cette route) :

```js
const crypto = require("crypto");
const SECRET = process.env.NOTIFICATION_HUB_CALLBACK_SECRET;

function verify(req) {
  const timestamp = req.get("X-Hub-Timestamp") || "";
  const signature = req.get("X-Hub-Signature-256") || "";
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", SECRET)
    .update(`${timestamp}.`).update(req.body).digest("hex");
  return signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

PHP (Laravel) :

```php
$timestamp = $request->header('X-Hub-Timestamp', '');
$signature = $request->header('X-Hub-Signature-256', '');
$expected = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $request->getContent(),
                                   env('NOTIFICATION_HUB_CALLBACK_SECRET'));
$valid = ctype_digit($timestamp) && abs(time() - (int) $timestamp) <= 300
      && hash_equals($expected, $signature);
```

Le secret peut être renouvelé par l'administrateur : l'ancien cesse alors immédiatement de fonctionner. Convenez du moment du changement avec lui.

## 9. Erreurs et conduite à tenir

Toutes les erreurs ont le même format :

```json
{"error": {"code": "invalid_template_parameters", "message": "…", "details": […], "request_id": "4b1e…"}}
```

Basez votre code sur `error.code` (stable), pas sur `message` (indicatif). Indiquez le `request_id` (aussi dans l'en-tête `X-Request-ID`) quand vous contactez le support.

| HTTP | `error.code` | Cause | Rejouer ? |
| --- | --- | --- | --- |
| 400 | `idempotency_key_required` | En-tête `Idempotency-Key` absent ou invalide | Non, corriger |
| 400 | `invalid` | Champ invalide (détail par champ dans `details`) | Non, corriger |
| 401 | `not_authenticated` / `authentication_failed` | Clé absente, erronée, révoquée ou expirée | **Non**, alerter (risque de blocage IP) |
| 403 | `application_suspended` | Application suspendue par l'administrateur | Non |
| 403 | `insufficient_scope` | La clé n'a pas le droit pour cette opération | Non |
| 403 | `marketing_not_enabled` | Consentement envoyé par une application non autorisée au marketing | Non, voir l'administrateur |
| 404 | `not_found` | Message inexistant ou d'une autre application | Non |
| 409 | `idempotency_key_conflict` | Clé déjà utilisée avec un autre contenu | Non : bug d'intégration |
| 413 | `request_too_large` | Requête trop volumineuse | Non |
| 422 | `template_not_available` | Modèle inconnu, non autorisé pour vous, ou non envoyable | Non, voir l'administrateur |
| 422 | `invalid_template_parameters` | Variables non conformes au modèle (liste dans `details`) | Non, corriger |
| 422 | `recipient_opted_out` | Le destinataire a demandé à ne plus rien recevoir | **Non**, ne pas contourner |
| 422 | `marketing_consent_required` | Message marketing vers un destinataire sans consentement enregistré | **Non**, ne pas contourner |
| 429 | `throttled` | Limite de débit atteinte | Oui, après `Retry-After` secondes |
| 5xx, timeout, réseau | — | Incident temporaire | **Oui, même requête et même `Idempotency-Key`**, avec attente croissante (2 s, 5 s, 15 s, 60 s…) |

## 10. Limites

| Limite | Valeur |
| --- | --- |
| Envois (`POST /messages/`) | 60 par minute **par application** (toutes clés confondues) |
| Consultations (`GET`) | 300 par minute par application |
| Par adresse IP (frontal) | Une limite par IP peut s'appliquer en amont (ordre de grandeur : 20 requêtes/s) |
| Taille d'une requête | 1 Mo recommandé (une notification fait quelques Ko) |

Pour des envois en masse (rappels quotidiens, campagnes), étalez les envois et respectez `Retry-After`. Si vos volumes dépassent ces limites, prévenez l'administrateur du hub à l'avance. Meta impose aussi un plafond quotidien de destinataires pour le numéro de l'entreprise, partagé entre toutes les applications.

## 11. Exemples de code

### Python (requests)

```python
import os, uuid, requests

HUB_URL = os.environ["NOTIFICATION_HUB_URL"]
HUB_KEY = os.environ["NOTIFICATION_HUB_API_KEY"]

def send_whatsapp(recipient, template, params, idempotency_key, metadata=None):
    """idempotency_key : généré et enregistré AVANT l'appel, réutilisé tel quel en cas de reprise."""
    components = [{"type": "body", "parameters": [{"type": "text", "text": str(p)} for p in params]}] if params else []
    resp = requests.post(
        f"{HUB_URL}/messages/",
        headers={"Authorization": f"Bearer {HUB_KEY}", "Idempotency-Key": idempotency_key},
        json={"recipient": recipient, "template": template, "language": "fr",
              "components": components, "metadata": metadata or {}},
        timeout=10,
    )
    if resp.status_code in (200, 202):
        return resp.json()["id"]
    error = resp.json().get("error", {})
    raise HubError(resp.status_code, error.get("code"), error.get("request_id"))

# Exemple
key = f"kyc-reminder-{doctor.id}-{today:%Y-%m-%d}"
message_id = send_whatsapp("+237690123456", "dmi_doctor_kyc_reminder", ["04/12/2026", 30], key,
                           {"doctor_id": str(doctor.id)})
```

### JavaScript / Node.js (fetch, Node 18+)

```js
const HUB_URL = process.env.NOTIFICATION_HUB_URL;
const HUB_KEY = process.env.NOTIFICATION_HUB_API_KEY;

async function sendWhatsapp({ recipient, template, params = [], idempotencyKey, metadata = {} }) {
  const components = params.length
    ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }]
    : [];
  const resp = await fetch(`${HUB_URL}/messages/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUB_KEY}`,
      "Idempotency-Key": idempotencyKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient, template, language: "fr", components, metadata }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await resp.json();
  if (resp.status === 200 || resp.status === 202) return body.id;
  throw Object.assign(new Error(body.error?.code), { status: resp.status, requestId: body.error?.request_id });
}
```

### PHP (Laravel HTTP client)

```php
$response = Http::withToken(env('NOTIFICATION_HUB_API_KEY'))
    ->withHeaders(['Idempotency-Key' => $idempotencyKey])
    ->timeout(10)
    ->post(env('NOTIFICATION_HUB_URL') . '/messages/', [
        'recipient'  => '+237690123456',
        'template'   => 'dmi_doctor_kyc_reminder',
        'language'   => 'fr',
        'components' => [['type' => 'body', 'parameters' => [
            ['type' => 'text', 'text' => '04/12/2026'],
            ['type' => 'text', 'text' => '30'],
        ]]],
        'metadata'   => ['doctor_id' => (string) $doctor->id],
    ]);

if (in_array($response->status(), [200, 202])) {
    $messageId = $response->json('id');
}
```

Bonnes pratiques communes :

- Appelez le hub **depuis une tâche de fond** (file de jobs) plutôt que dans la requête de l'utilisateur : un incident réseau ne doit pas bloquer votre application.
- Timeout HTTP de 10 s ; en cas de timeout, rejouez avec la **même** clé.
- Si votre envoi fait partie d'une transaction métier, appelez le hub **après** la validation (commit) de cette transaction.

## 12. Checklist de mise en production

- ☐ Application créée sur le hub, clé reçue et stockée dans le coffre de secrets.
- ☐ `GET /me/` répond 200 depuis le serveur de production.
- ☐ `GET /templates/` liste bien tous les modèles nécessaires.
- ☐ Les variables envoyées correspondent, dans l'ordre, aux `{{1}}`, `{{2}}`… de chaque modèle.
- ☐ Numéros stockés et envoyés au format international (`+237…`).
- ☐ `Idempotency-Key` générée par notification métier, enregistrée avant l'appel, réutilisée en reprise.
- ☐ Reprises uniquement sur 429, 5xx et erreurs réseau ; aucune reprise sur 400, 401, 403, 409, 422.
- ☐ `id` du message conservé ; statuts `failed` détectés et traités.
- ☐ Aucune donnée de santé ni secret dans `metadata` ; clé masquée dans les logs.
- ☐ Test réel sur un numéro interne : statut `delivered` constaté.

## 13. Hors périmètre aujourd'hui

- **Messages libres** (sans modèle) : non supportés.
- **Réponses des utilisateurs** : un utilisateur qui répond au numéro WhatsApp n'est lu par personne. Ne demandez pas de réponse dans vos modèles.
- **Désinscription** : gérée par l'administrateur du hub (liste d'exclusion). Si un utilisateur vous demande de ne plus recevoir de messages WhatsApp, transmettez sa demande.

## 14. Support

- Administrateur du hub : *(à compléter : nom, e-mail, canal)*.
- Toujours fournir : identifiant d'application, `request_id` ou `id` du message, date et heure.
- Ne jamais envoyer la clé API complète au support : le préfixe (`nhk_<préfixe>_…`) suffit.