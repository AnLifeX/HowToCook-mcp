import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const assetsRoot = resolve(process.argv[2] || join(projectRoot, '..', 'HowToCook-assets'));
const channel = JSON.parse(await readFile(join(assetsRoot, 'channels', 'v2-stable.json'), 'utf8'));
const manifestPath = join(assetsRoot, ...channel.manifestPath.split('/'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const versionRoot = dirname(manifestPath);

if (manifest.schemaVersion !== 2 || channel.schemaVersion !== 2) {
  throw new Error(`仅支持 schemaVersion=2，当前 channel=${channel.schemaVersion}, manifest=${manifest.schemaVersion}`);
}

const recipes = await Promise.all(
  manifest.recipes.map(async (item) => {
    const recipePath = join(versionRoot, 'recipes', item.category, `${item.id}.json`);
    const recipe = JSON.parse(await readFile(recipePath, 'utf8'));
    if (recipe.schemaVersion !== 2 || recipe.id !== item.id) {
      throw new Error(`菜谱数据不一致: ${recipePath}`);
    }
    return recipe;
  }),
);

const bundle = {
  schemaVersion: 2,
  dataVersion: manifest.dataVersion,
  generatedAt: manifest.generatedAt,
  source: manifest.source,
  recipeCount: recipes.length,
  recipes,
};

const output = join(projectRoot, 'src', 'data', 'all_recipes.json');
await writeFile(output, `${JSON.stringify(bundle)}\n`, 'utf8');
console.log(`已同步 HowToCook V2 ${manifest.dataVersion}: ${recipes.length} 份菜谱 -> ${output}`);
