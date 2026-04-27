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

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item));
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

const queryRecord = z
  .record(z.union([z.string(), z.number(), z.array(z.string())]))
  .optional()
  .describe(
    "Paramètres de requête additionnels (ex. filtres API Platform : page, itemsPerPage, etc.)."
  );

const server = new McpServer({ name: "turnoverit", version: "1.0.0" });

// ─── TalentSearch (authentifié) ──────────────────────────────────────────────

server.registerTool(
  "get_talent_search",
  {
    title: "TalentSearch · Recherche candidats",
    description:
      "GET /users/talentsearch — recherche dans la CVthèque Turnover-IT. Nécessite TURNOVERIT_API_TOKEN (Bearer). Les filtres exacts dépendent de votre contrat ; utilisez query pour passer des paramètres d'URL.",
    inputSchema: {
      query: queryRecord
    },
    annotations: { ...READ_ONLY, title: "TalentSearch · Recherche candidats" }
  },
  async ({ query }) => {
    const auth = bearerAuthorization();
    if (!auth) {
      return err(
        new Error(
          "TURNOVERIT_API_TOKEN manquant. Ajoutez le jeton TalentSearch (section TalentSearch de la plateforme) dans la configuration de l'extension."
        )
      );
    }
    try {
      const path = `/users/talentsearch${buildQuery(query)}`;
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
      "GET /jobs_skills/autocomplete — suggestions de métiers et compétences à partir du préfixe q.",
    inputSchema: {
      q: z.string().describe("Texte de recherche (préfixe ou terme)")
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
      "GET /locations/search — géolocalisations (villes, régions). Paramètre obligatoire : search.",
    inputSchema: {
      search: z.string().min(1).describe("Terme de recherche lieu (ex. Paris, Lyon)"),
      query: queryRecord
    },
    annotations: { ...READ_ONLY, title: "TalentSearch · Recherche lieux" }
  },
  async ({ search, query }) => {
    try {
      const merged = { ...query, search };
      const path = `/locations/search${buildQuery(merged)}`;
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
