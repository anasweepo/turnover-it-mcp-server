import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = "https://api.turnover-it.com";

function bearerAuthorization() {
  const raw = process.env.TURNOVERIT_API_TOKEN?.trim();
  if (!raw) return null;
  return /^Bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
}

const headersJson = { Accept: "application/json" };

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * FIX: les paramètres tableaux doivent utiliser le suffixe "[]"
 * ex: locations[] availabilities[] contracts[]
 */
function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // FIX: ajout du suffixe [] pour que l'API Turnover-IT accepte les tableaux
      for (const item of value) usp.append(`${key}[]`, String(item));
    } else {
      usp.append(key, String(value));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function apiGet(path, headers) {
  const res = await fetch(`${BASE}${path}`, { headers: { ...headersJson, ...headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(e) {
  return { content: [{ type: "text", text: `Erreur: ${e.message}` }] };
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const server = new McpServer({ name: "turnoverit", version: "1.1.0" });

// ─── TalentSearch (authentifié) ──────────────────────────────────────────────

server.registerTool(
  "get_talent_search",
  {
    title: "TalentSearch · Recherche candidats",
    description: `Recherche de candidats dans la CVthèque Turnover-IT (GET /users/talentsearch). Nécessite TURNOVERIT_API_TOKEN.

WORKFLOW RECOMMANDÉ :
1. Appeler get_locations_search pour obtenir la clé de lieu (champ "key", ex: "fr~ile-de-france~paris~")
2. Appeler get_jobs_skills_autocomplete pour trouver le bon slug de compétence si besoin
3. Appeler get_talent_search avec les paramètres obtenus

IMPORTANT : Au moins "keywords" ou "profileJobTitle" est requis.
Chaque candidat retourné consomme 1 crédit (max 1 crédit/candidat/30 jours).`,
    inputSchema: {
      keywords: z
        .string()
        .max(512)
        .optional()
        .describe('Recherche texte libre sur le profil (ex: "react", "développeur python fullstack"). Max 512 caractères. Au moins keywords ou profileJobTitle requis.'),

      profileJobTitle: z
        .string()
        .max(250)
        .optional()
        .describe('Recherche par intitulé de poste du profil (ex: "Développeur React"). Max 250 caractères.'),

      limit: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe("Nombre de résultats à retourner (max 30). Défaut : 10."),

      locations: z
        .array(z.string())
        .optional()
        .describe('Clés de lieux obtenues via get_locations_search (champ "key"). Exemple : ["fr~ile-de-france~paris~"]. Toujours utiliser get_locations_search en premier pour obtenir la clé exacte.'),

      locationRadius: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Rayon de recherche géographique en km autour du lieu (ex: 30)."),

      availabilities: z
        .array(z.enum(["immediate", "within_1_month", "within_2_month", "within_3_month", "more_than_3_month"]))
        .optional()
        .describe('Disponibilité du candidat. Valeurs : "immediate" (immédiate), "within_1_month", "within_2_month", "within_3_month", "more_than_3_month".'),

      contracts: z
        .array(z.enum(["PERMANENT", "TEMPORARY", "FREELANCE", "INTERNSHIP", "APPRENTICESHIP", "INTERCONTRACT"]))
        .optional()
        .describe('Types de contrat recherchés : "PERMANENT" (CDI), "TEMPORARY" (CDD), "FREELANCE", "INTERNSHIP" (stage), "APPRENTICESHIP" (alternance), "INTERCONTRACT" (intercontrat).'),

      remoteModes: z
        .array(z.enum(["none", "partial", "full"]))
        .optional()
        .describe('Mode de travail à distance : "none" (présentiel), "partial" (hybride), "full" (full remote).'),

      experienceYears: z
        .array(z.enum(["less_than_1_year", "1-2_years", "3-4_years", "5-10_years", "11-15_years", "more_than_15_years"]))
        .optional()
        .describe("Années d'expérience du candidat."),

      diplomaLevels: z
        .array(z.enum(["less_or_equal_than_1_year", "2_years", "3_years", "4_years", "5_years", "more_or_equal_than_6_years"]))
        .optional()
        .describe("Niveau de diplôme du candidat (années d'études après le bac)."),

      sort: z
        .enum(["relevance", "date", "experience", "next_availability_at", "daily_salary", "annual_salary"])
        .optional()
        .describe('Critère de tri : "relevance" (pertinence), "date", "experience", "next_availability_at", "daily_salary", "annual_salary".'),

      order: z
        .enum(["asc", "desc"])
        .optional()
        .describe('Ordre de tri : "asc" (croissant) ou "desc" (décroissant, défaut).'),

      minDailySalary: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("TJM (taux journalier moyen) minimum souhaité en EUR."),

      maxDailySalary: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("TJM (taux journalier moyen) maximum souhaité en EUR."),

      minAnnualSalary: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Salaire annuel brut minimum souhaité en EUR."),

      maxAnnualSalary: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Salaire annuel brut maximum souhaité en EUR."),

      mobilities: z
        .array(z.enum(["mobility", "residence"]))
        .optional()
        .describe('Filtrer sur mobilité ("mobility") ou lieu de résidence ("residence").'),

      languages: z
        .array(z.string())
        .optional()
        .describe('Langues parlées par le candidat (codes ISO, ex: ["fr", "en"]).'),

      companyInExperiences: z
        .string()
        .max(250)
        .optional()
        .describe("Filtrer les candidats ayant travaillé dans une entreprise spécifique."),

      certification: z
        .string()
        .max(250)
        .optional()
        .describe("Filtrer les candidats possédant une certification spécifique.")
    },
    annotations: { ...READ_ONLY, title: "TalentSearch · Recherche candidats" }
  },
  async (params) => {
    const auth = bearerAuthorization();
    if (!auth) {
      return err(
        new Error(
          "TURNOVERIT_API_TOKEN manquant. Ajoutez le jeton TalentSearch (section TalentSearch de la plateforme) dans la configuration de l'extension."
        )
      );
    }
    try {
      const path = `/users/talentsearch${buildQuery(params)}`;
      return ok(await apiGet(path, { Authorization: auth }));
    } catch (e) {
      return err(e);
    }
  }
);

// ─── Métiers & compétences (public) ─────────────────────────────────────────

server.registerTool(
  "get_jobs_skills_autocomplete",
  {
    title: "TalentSearch · Autocomplete métiers & compétences",
    description:
      `Autocomplétion de métiers et compétences (GET /jobs_skills/autocomplete). Ne nécessite pas d'authentification.
Utiliser avant get_talent_search pour valider l'orthographe d'une compétence ou d'un métier.
Retourne un tableau d'objets avec :
- "name" : libellé affiché (ex: "React")
- "slug" : identifiant technique (ex: "react")
- "type" : "skill" (compétence technique) ou "job" (métier/poste)`,
    inputSchema: {
      q: z.string().min(1).describe('Chaîne de recherche à compléter (ex: "react", "python", "chef de proj"). Retourne les métiers et compétences correspondants.')
    },
    annotations: {
      ...READ_ONLY,
      title: "TalentSearch · Autocomplete métiers & compétences"
    }
  },
  async ({ q }) => {
    try {
      const path = `/jobs_skills/autocomplete${buildQuery({ q })}`;
      return ok(await apiGet(path, {}));
    } catch (e) {
      return err(e);
    }
  }
);

// ─── Lieux (public) ──────────────────────────────────────────────────────────

server.registerTool(
  "get_locations_search",
  {
    title: "TalentSearch · Recherche lieux",
    description:
      `Recherche de lieux géolocalisés par nom (GET /locations/search). Ne nécessite pas d'authentification.
TOUJOURS appeler cet outil avant get_talent_search pour obtenir la clé de lieu exacte.
Exemple : search="Paris" → retourne key="fr~ile-de-france~paris~" à passer dans locations[] de get_talent_search.
Retourne un tableau d'objets avec :
- "key" : clé unique du lieu à utiliser dans get_talent_search (champ "locations")
- "label" : libellé complet (ex: "Paris, France")
- "shortLabel" : libellé court (ex: "Paris")
- "locality", "postalCode", "adminLevel1", "adminLevel2", "country", "countryCode", "latitude", "longitude"`,
    inputSchema: {
      search: z.string().min(1).describe('Nom de la ville ou région à rechercher (ex: "Paris", "Lyon", "Lille", "Île-de-France"). Paramètre obligatoire.')
    },
    annotations: { ...READ_ONLY, title: "TalentSearch · Recherche lieux" }
  },
  async ({ search }) => {
    try {
      const path = `/locations/search${buildQuery({ search })}`;
      return ok(await apiGet(path, {}));
    } catch (e) {
      return err(e);
    }
  }
);

// ─── Démarrage ───────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

if (!bearerAuthorization()) {
  console.error(
    "ℹ️ TURNOVERIT_API_TOKEN absent — get_talent_search sera indisponible jusqu'à configuration du jeton."
  );
}
console.error("✅ Turnover-IT MCP Server démarré");
