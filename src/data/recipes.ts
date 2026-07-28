import { Recipe, RecipeBundle } from '../types/index.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOCAL_RECIPES_PATH = join(__dirname, 'all_recipes.json');

let dataVersion = 'unknown';

export async function fetchRecipes(): Promise<Recipe[]> {
  try {
    const data = JSON.parse(readFileSync(LOCAL_RECIPES_PATH, 'utf-8')) as RecipeBundle | Recipe[];
    const recipes = Array.isArray(data) ? data : data.recipes;
    dataVersion = Array.isArray(data) ? 'legacy' : data.dataVersion;
    console.log(`✅ 成功从本地加载 ${recipes.length} 个 V2 菜谱（数据版本 ${dataVersion}）`);
    return recipes;
  } catch (error) {
    console.error('❌ 加载本地菜谱数据失败:', error);
    return [];
  }
}

export function getRecipeDataVersion(): string {
  return dataVersion;
}

export function getAllCategories(recipes: Recipe[]): string[] {
  return [...new Set(recipes.map((recipe) => recipe.category).filter(Boolean))];
}
