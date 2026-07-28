import { z } from "zod";
import { Recipe } from "../types/index.js";
import { simplifyRecipeNameOnly } from "../utils/recipeUtils.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGetAllRecipesTool(server: McpServer, recipes: Recipe[]) {
  server.tool(
    "mcp_howtocook_getAllRecipes",
    "获取 V2 菜谱索引，返回稳定 UUID、名称、简介、分类、难度和热量",
    {
      'no_param': z.string().optional()
                       .describe('无参数')
    },
    async () => {
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
    }
  );
}
