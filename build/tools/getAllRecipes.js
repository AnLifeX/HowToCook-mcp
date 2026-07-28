import { z } from "zod";
import { simplifyRecipeNameOnly } from "../utils/recipeUtils.js";
export function registerGetAllRecipesTool(server, recipes) {
    server.tool("mcp_howtocook_getAllRecipes", "获取 V2 菜谱索引，返回稳定 UUID、名称、简介、分类、难度和热量", {
        'no_param': z.string().optional()
            .describe('无参数')
    }, async () => {
        // 返回足够用于搜索和选择的 V2 索引。
        const simplifiedRecipes = recipes.map(simplifyRecipeNameOnly);
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
