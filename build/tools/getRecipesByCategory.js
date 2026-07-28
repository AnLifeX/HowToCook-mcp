import { z } from 'zod';
import { simplifyRecipe } from '../utils/recipeUtils.js';
export function registerGetRecipesByCategoryTool(server, recipes, categories) {
    const categoryDescriptions = [...new Set(recipes.map((recipe) => `${recipe.category}(${recipe.categoryName})`))];
    server.tool('mcp_howtocook_getRecipesByCategory', `按 V2 分类 ID 或中文分类名查询菜谱。可用分类：${categoryDescriptions.join('、')}`, {
        category: z.string().describe(`分类 ID 或中文名，可用 ID：${categories.join(', ')}`),
    }, async ({ category }) => {
        const filteredRecipes = recipes.filter((recipe) => recipe.category === category || recipe.categoryName === category);
        return {
            content: [{ type: 'text', text: JSON.stringify(filteredRecipes.map(simplifyRecipe), null, 2) }],
        };
    });
}
