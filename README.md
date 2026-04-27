# Turnover-IT MCP

Bundle **MCPB** (extension Claude Desktop) pour l’API **TalentSearch** [Turnover-IT](https://turnover-it.com). Serveur MCP **Node stdio**.

## Outils (lecture seule, GET)

| Outil | Endpoint |
| ----- | -------- |
| `get_talent_search` | `GET https://api.turnover-it.com/users/talentsearch` — **Bearer requis** |
| `get_jobs_skills_autocomplete` | `GET https://api.turnover-it.com/jobs_skills/autocomplete` |
| `get_locations_search` | `GET https://api.turnover-it.com/locations/search` (paramètre `search`) |

## Installation (utilisateur)

1. Télécharger le fichier `turnoverit-mcp-vX.Y.Z.mcpb` depuis les [Releases](https://github.com/anasweepo/turnover-it-mcp-server/releases) du dépôt.
2. **Settings → Extensions → Install from file…** (ou double-clic sur le `.mcpb`).
3. Optionnel : renseigner le jeton **TalentSearch** (plateforme Turnover-IT, section TalentSearch) pour utiliser la recherche candidats.
4. **Install**.

Le `.mcpb` est produit uniquement par la CI sur chaque tag `v*`, pas dans l’archive ZIP du code source.

## Développement local

```bash
cd server
npm install
# Optionnel, pour get_talent_search :
set TURNOVERIT_API_TOKEN=votre_jeton
node index.js
```

Build MCPB local :

```bash
cd server && npm ci --omit=dev && cd ..
npx @anthropic-ai/mcpb validate manifest.json
npx @anthropic-ai/mcpb pack . turnoverit-mcp-local.mcpb
```

## Publier une version

Aligner `version` dans `manifest.json` avec le tag, puis :

```bash
git add manifest.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

Le workflow `.github/workflows/release.yml` valide le manifest, exécute `mcpb pack` et attache le `.mcpb` à la release GitHub.

## Licence

MIT
