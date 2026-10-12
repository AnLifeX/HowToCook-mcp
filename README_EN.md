# HowToCook MCP Server

[简体中文](./README.md) | English

Repository: [AnLifeX/HowToCook-mcp](https://github.com/AnLifeX/HowToCook-mcp). Server version `0.3.0` provides recipe lookup, random menus, weekly meal plans, and V2 recipe normalization.

## Data and tools

At startup, the server reads local `build/data/all_recipes.json`. It does not automatically sync remote data or call an AI model API. The current bundle contains 367 V2 recipes from data version `2026.07.28.1`, with stable UUIDs and legacy IDs.

Recipes originate from [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook); V2 data is maintained in [AnLifeX/HowToCook-assets](https://github.com/AnLifeX/HowToCook-assets). This server can run independently. Since version 0.5.0, the Flutter app uses its own built-in recipe tools and no longer depends on this MCP server.

| Tool | Parameters | Actual behavior |
| --- | --- | --- |
| `mcp_howtocook_getAllRecipes` | No required parameters | Returns the full index: UUID, name, description, category, difficulty, and calories. No full steps or pagination. |
| `mcp_howtocook_getRecipesByCategory` | `category` | Matches a category ID or Chinese label exactly; returns summaries and ingredient quantities. |
| `mcp_howtocook_getRecipeById` | `query` | Matches UUID / legacy ID, exact name, then a name substring; returns the first full matching V2 recipe. If no name matches, it may return up to five description matches. |
| `mcp_howtocook_recommendMeals` | `peopleCount`; optional `allergies`, `avoidItems` | Filters ingredient names by substring, then randomly builds seven days of meals and a grocery list. Requires an integer from 1 to 10; meals may be incomplete if candidates run out. |
| `mcp_howtocook_whatToEat` | `peopleCount` | Randomly combines meat dishes and dishes from other categories for an integer from 1 to 10. Does not accept allergy or avoidance parameters. |
| `mcp_howtocook_createRecipe` | `recipe` or `recipeText`; optional `checkDuplicate`, `similarityThreshold` | Normalizes caller-provided content to V2 and checks name similarity. Returns the result without saving files or adding it to the searchable collection. |

Categories: `aquatic` (水产), `breakfast` (早餐), `condiment` (调料), `dessert` (甜品), `drink` (饮料), `meat_dish` (荤菜), `semi-finished` (半成品), `soup` (汤粥), `staple` (主食), and `vegetable_dish` (素菜).

Weekly recommendations do not optimize nutrition or determine allergy safety. Grocery lists retain original quantity examples and recipe references; they do not convert units, scale ingredient quantities by party size, or calculate exact total purchase weights. Tool results use MCP text content whose `text` contains JSON.

## Run from source

Requirements: Node.js ≥ 18 (matching `package.json` and locked dependencies), npm.

```bash
git clone https://github.com/AnLifeX/HowToCook-mcp.git
cd HowToCook-mcp
npm ci
npm run build
npm start
```

`npm run build` compiles TypeScript and copies `src/data/all_recipes.json` into the build directory. The default is HTTP on `0.0.0.0:9000`. There is no built-in authentication; configure access control at the deployment entry point when exposing the service.

### Transports and endpoints

| Setting | Default | Environment variables |
| --- | --- | --- |
| `--transport <http\|sse\|stdio>` | `http` | `transport`, then `TRANSPORT` |
| `--port <number>` | `9000` | `PORT`, then `port`; used for HTTP / SSE |

Environment variables override command-line arguments, in the order listed above. The server does not load `.env` automatically; set variables in the launch environment.

```bash
node build/index.js --transport http --port 8080
```

Both HTTP and SSE modes expose these routes:

- `http://localhost:9000/mcp`: Streamable HTTP MCP endpoint.
- `http://localhost:9000/sse`: SSE connection endpoint; messages are posted to `/messages?sessionId=...`.
- `http://localhost:9000/health`: health status, transport, schema version, and data version.
- `http://localhost:9000/info`: server version, data version, endpoints, and recipe count.

Available scripts: `npm run start:http`, `npm run start:sse`, and `npm run start:stdio`. Environment variables still override their transport arguments.

### Connect an MCP client

For clients supporting Streamable HTTP, use `http://localhost:9000/mcp`. Replace it with your own service URL for a remote deployment. Configuration syntax depends on the client.

Local stdio example (replace the path with your actual absolute path):

```json
{
  "mcpServers": {
    "howtocook-mcp": {
      "command": "node",
      "args": ["D:/path/HowToCook-mcp/build/index.js", "--transport", "stdio"]
    }
  }
}
```

The current source also writes startup and data-loading logs to stdout, which may interfere with strict stdio clients. Prefer HTTP; verify stdio compatibility separately. The client process's `transport` / `TRANSPORT` environment variables can also override these arguments.

## Update bundled V2 data

Place `HowToCook-assets` alongside this repository, then run:

```bash
npm run sync:v2-data
npm run build
```

Alternatively, pass the local assets repository path:

```bash
npm run sync:v2-data -- D:/path/HowToCook-assets
npm run build
```

The script reads the local repository's `channels/v2-stable.json` and corresponding manifest, then bundles recipes into `src/data/all_recipes.json`. Restart the server after building to load the new data. The script does not pull from Git remotes.

## Example tool arguments

These are tool arguments, not complete MCP request messages:

```json
{"query": "宫保鸡丁"}
```

```json
{"category": "aquatic"}
```

```json
{"peopleCount": 3, "allergies": ["虾"], "avoidItems": ["香菜"]}
```

`createRecipe` prefers a structured `recipe` with a `name`, a non-empty `ingredients` array, and a non-empty `steps` array:

```json
{
  "recipe": {
    "name": "Example stir-fried greens",
    "description": "Simple home-style greens",
    "category": "vegetable_dish",
    "categoryName": "素菜",
    "ingredients": [
      {"name": "Greens", "text": "Greens 300 g"},
      {"name": "Oil", "text": "Oil 10 ml"},
      {"name": "Salt", "text": "Salt 2 g"}
    ],
    "steps": [
      {"description": "Wash and drain the greens."},
      {"description": "Heat the oil, stir-fry the greens until cooked, and season with salt."}
    ]
  }
}
```

Optional fields include description, difficulty, calories, requirements, tools, calculation notes, tips, and warnings. Name-based duplicate checking is enabled by default, with a warning threshold of `0.75`. Among candidates passing that threshold, similarity ≥ `0.9` rejects creation. Set `checkDuplicate: false` to disable the check. The caller supplies the recipe content; the server does not generate or persist it.

## DXT and license

The repository retains `manifest.json` and a prebuilt `HowToCook-mcp.dxt`, with updated manifest and documentation. This update does not rebuild runtime code or verify desktop client installation. Future source or manifest changes require updating the archive as well. This README documents running from source.

`package.json` and the extension manifest declare ISC for the code. Recipe data sources are linked above.
