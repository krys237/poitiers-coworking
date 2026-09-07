import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Contrôle quotidien du barème officiel (CNPS / CGI) — 06:00 UTC = 07:00 Douala.
crons.daily("controle du bareme officiel", { hourUTC: 6, minuteUTC: 0 }, internal.bareme.controlerBaremeOfficiel, {});

// Purge hebdomadaire des verrous financiers expirés (sécurité : un verrou n'est jamais bloquant plus de 15 min, la purge nettoie les traces).
crons.weekly("purge des verrous financiers", { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 }, internal.financier.purgerVerrousExpires, {});

export default crons;
