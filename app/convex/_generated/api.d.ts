/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as archives from "../archives.js";
import type * as audit from "../audit.js";
import type * as bareme from "../bareme.js";
import type * as commandes from "../commandes.js";
import type * as comptesRendus from "../comptesRendus.js";
import type * as courrier from "../courrier.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as documentsIa from "../documentsIa.js";
import type * as employes from "../employes.js";
import type * as financier from "../financier.js";
import type * as http from "../http.js";
import type * as interventions from "../interventions.js";
import type * as journal from "../journal.js";
import type * as lib_absences from "../lib/absences.js";
import type * as lib_apiSecurite from "../lib/apiSecurite.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_calculBulletins from "../lib/calculBulletins.js";
import type * as lib_commandes from "../lib/commandes.js";
import type * as lib_courrier from "../lib/courrier.js";
import type * as lib_fenetre from "../lib/fenetre.js";
import type * as lib_journal from "../lib/journal.js";
import type * as lib_paie from "../lib/paie.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_tresorerie from "../lib/tresorerie.js";
import type * as paiePdf from "../paiePdf.js";
import type * as parametres from "../parametres.js";
import type * as payroll from "../payroll.js";
import type * as planning from "../planning.js";
import type * as primes from "../primes.js";
import type * as rbac from "../rbac.js";
import type * as seed from "../seed.js";
import type * as seedPhase3 from "../seedPhase3.js";
import type * as seedPhase4 from "../seedPhase4.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  archives: typeof archives;
  audit: typeof audit;
  bareme: typeof bareme;
  commandes: typeof commandes;
  comptesRendus: typeof comptesRendus;
  courrier: typeof courrier;
  crons: typeof crons;
  documents: typeof documents;
  documentsIa: typeof documentsIa;
  employes: typeof employes;
  financier: typeof financier;
  http: typeof http;
  interventions: typeof interventions;
  journal: typeof journal;
  "lib/absences": typeof lib_absences;
  "lib/apiSecurite": typeof lib_apiSecurite;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/calculBulletins": typeof lib_calculBulletins;
  "lib/commandes": typeof lib_commandes;
  "lib/courrier": typeof lib_courrier;
  "lib/fenetre": typeof lib_fenetre;
  "lib/journal": typeof lib_journal;
  "lib/paie": typeof lib_paie;
  "lib/stats": typeof lib_stats;
  "lib/tresorerie": typeof lib_tresorerie;
  paiePdf: typeof paiePdf;
  parametres: typeof parametres;
  payroll: typeof payroll;
  planning: typeof planning;
  primes: typeof primes;
  rbac: typeof rbac;
  seed: typeof seed;
  seedPhase3: typeof seedPhase3;
  seedPhase4: typeof seedPhase4;
  stats: typeof stats;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
