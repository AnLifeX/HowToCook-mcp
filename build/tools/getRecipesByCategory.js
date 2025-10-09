import { z } from "zod";
import { simplifyRecipe } from "../utils/recipeUtils.js";
export function registerGetRecipesByCategoryTool(server, recipes, categories) {
    server.tool("mcp_howtocook_getRecipesByCategory", `根据分类查询菜谱，可选分类有: ${categories.join(', ')}`, {
        category: z.enum(categories)
            .describe('菜谱分类名称，如水产、早餐、荤菜、主食等')
    }, async ({ category }) => {
        const filteredRecipes = recipes.filter((recipe) => recipe.category === category);
        // 返回简化版的菜谱数据
        const simplifiedRecipes = filteredRecipes.map(simplifyRecipe);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(simplifiedRecipes, null, 2),
                },
            ],
        };
    });
}
