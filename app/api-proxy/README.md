# API financière — proxy sécurisé

Expose les données du **grand livre financier journalier** à des systèmes tiers (comptabilité, BI) sans jamais
exposer le backend directement. Deux couches, toutes deux obligatoires :

| Couche | Où | Mécanismes |
|---|---|---|
| 1 — Proxy Node.js (ce dossier) | votre réseau | liste blanche IP · clé API (comparaison en temps constant) · rate-limit par IP · en-têtes de sécurité · logs JSON |
| 2 — Backend Convex (`convex/http.ts`) | déploiement | re-validation de la clé (`FINANCIAL_API_KEY`) · validation date/entité · journalisation |

## Démarrage

```bash
cd app/api-proxy
cp .env.example .env         # puis renseigner FINANCIAL_API_KEY (même valeur que le secret Convex)
node server.mjs              # Node ≥ 18, aucune dépendance
curl http://localhost:3100/health
```

Générer une clé (≥ 32 caractères aléatoires) et l'enregistrer des deux côtés :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx convex env set FINANCIAL_API_KEY <clé>     # côté backend (depuis app/)
```

En production : `pm2 start server.mjs --name poitiers-api-proxy && pm2 save && pm2 startup`.

## Appel type

```bash
curl "http://localhost:3100/api/financial?date=2026-09-07&entity=poitiers,lilas" -H "X-Api-Key: <clé>"
```

| Paramètre | Requis | Valeurs |
|---|---|---|
| `date` | oui | `YYYY-MM-DD` (journée saisie) |
| `entity` | non | `poitiers`, `lilas`, `carte_visa`, `edrtim_finance`, `medicaments`, `biodiagnostic`, `med_esthetic`, `autres` — plusieurs séparées par des virgules ; absent = toutes |

Réponse : `date`, `periode`, `cloture`, `entites{cle → libelle, lignes, entrees, retraits, net}`, `soldesOuverture`, `soldes`, `recetteTotale`.

| Code | Signification | Action |
|---|---|---|
| 200 | Succès | — |
| 400 | Date invalide ou entité inconnue | Corriger les paramètres |
| 401 | Clé absente ou invalide | Vérifier `X-Api-Key` (proxy **et** backend) |
| 403 | IP non autorisée | Ajouter l'IP à `ALLOWED_IPS` |
| 404 | Aucune journée saisie à cette date | Vérifier dans l'application |
| 429 | Quota dépassé (`Retry-After`) | Attendre ou augmenter `RATE_LIMIT_RPM` |
| 502 | Backend injoignable | Vérifier `CONVEX_SITE_URL` |
| 503 | Clé non configurée côté backend | `npx convex env set FINANCIAL_API_KEY …` |

## Exposition publique

- **HTTPS** obligatoire : placez le proxy derrière Nginx / Caddy / Traefik avec un certificat valide ; bloquez le port 3100 depuis Internet (pare-feu).
- Renseignez **ALLOWED_IPS** avec les adresses des systèmes consommateurs.
- **Rotation de la clé** tous les 6 mois ou immédiatement en cas de doute : changer le secret Convex puis le `.env` du proxy.
- Les logs JSON (stdout) contiennent ip, chemin, entité, date, statut, durée — redirigez-les vers votre supervision (SIEM).
- Tenez un registre des intégrations actives (système, IP, responsable, date) ; révoquez les accès inutiles.
