import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Contrôle quotidien du barème officiel (CNPS / CGI) — 06:00 UTC = 07:00 Douala.
crons.daily("controle du bareme officiel", { hourUTC: 6, minuteUTC: 0 }, internal.bareme.controlerBaremeOfficiel, {});

// Purge hebdomadaire des verrous financiers expirés (sécurité : un verrou n'est jamais bloquant plus de 15 min, la purge nettoie les traces).
crons.weekly("purge des verrous financiers", { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 }, internal.financier.purgerVerrousExpires, {});

// Purge hebdomadaire des notifications lues de plus de 90 jours : la table grossit d'environ
// 6 000 lignes par mois, et l'historique au-delà d'un trimestre n'a plus d'usage.
crons.weekly("purge des notifications", { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 }, internal.notifications.purger, {});

// Rappels des comptes rendus (lot S5) : à l'ouverture du créneau puis 30 min avant fermeture
// (heures de Douala, UTC+1 fixe ; les heures réelles viennent des réglages).
crons.interval("rappels des comptes rendus", { minutes: 30 }, internal.rappels.comptesRendus, {});

// Journée financière non saisie (lot S5) — 18:00 Douala = 17:00 UTC.
crons.daily("rappel journee financiere", { hourUTC: 17, minuteUTC: 0 }, internal.rappels.journeeFinanciere, {});

// Mois de paie non clôturé (lot S5) — 08:00 Douala = 07:00 UTC (agit uniquement 3 j avant paiement).
crons.daily("rappel cloture de paie", { hourUTC: 7, minuteUTC: 0 }, internal.rappels.cloturePaie, {});

// Dossiers qui dorment (lot S5) : relance palier 1 puis escalade palier 2 (niveau >= 7).
crons.hourly("relance des dossiers en attente", { minuteUTC: 30 }, internal.rappels.dossiersEnAttente, {});

// Pense-bêtes personnels arrivés à échéance (lot S7) — toutes les 15 minutes.
crons.interval("pense-betes a echeance", { minutes: 15 }, internal.penseBetes.declencher, {});

export default crons;

