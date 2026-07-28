import { z } from 'zod';
import { calculateSimilarity, parseRecipeFromInput, parseRecipeText } from '../utils/recipeParser.js';
const requirementSchema = z.union([
    z.string(),
    z.object({
        text: z.string(),
        markdown: z.string().optional(),
        group: z.string().nullable().optional(),
        kind: z.enum(['ingredient', 'tool', 'unknown']).optional(),
    }),
]);
const ingredientSchema = z.union([
    z.string(),
    z.object({
        name: z.string(),
        text: z.string(),
        optional: z.boolean().optional(),
        source: z.string().optional(),
        table: z.record(z.string()).optional(),
    }),
]);
const stepSchema = z.union([
    z.string(),
    z.object({
        kind: z.enum(['step', 'heading']).optional(),
        title: z.string().optional(),
        description: z.string(),
    }),
]);
const structuredRecipeSchema = z.object({
    name: z.string().describe('菜谱名称，不要添加“的做法”'),
    description: z.string().optional().describe('菜谱简介：风味、营养、难度和预计耗时'),
    category: z.string().optional().describe('分类 ID，如 meat_dish、vegetable_dish、staple'),
    categoryName: z.string().optional().describe('中文分类名'),
    difficulty: z.number().int().min(1).max(5).optional(),
    estimatedCaloriesKcal: z.number().int().positive().optional().describe('估算整份菜谱热量'),
    requirements: z.array(requirementSchema).optional().describe('必备原料和工具，不要在这里强行填写水等基础用量'),
    ingredients: z.array(ingredientSchema).min(1).describe('用量与计算中的完整食材及数量，可包含水'),
    tools: z.array(z.string()).optional(),
    calculationNotes: z.array(z.string()).optional().describe('份量公式、比例和计算前提'),
    steps: z.array(stepSchema).min(1).describe('操作内容，description 中不要再写序号'),
    tips: z.string().optional(),
    warnings: z.array(z.string()).optional(),
});
export function registerCreateRecipeTool(server, recipes) {
    server.tool('mcp_howtocook_createRecipe', `创建 HowToCook V2 菜谱。优先传入 recipe 结构化对象；也兼容 recipeText 文本。
返回的菜谱使用 schemaVersion=2 和稳定 UUID，完整保留菜谱简介、热量、必备原料和工具、用量与计算、操作、贴士与警告。
“必备”只写需特别准备的原料/工具；水、油等虽可不出现在必备项，但用到时必须出现在 ingredients 的用量中。操作 description 不要自带 1. 2. 序号。`, {
        recipeText: z.string().optional().describe('兼容旧客户端的自然语言或 Markdown 菜谱'),
        recipe: structuredRecipeSchema.optional().describe('推荐：V2 结构化菜谱'),
        checkDuplicate: z.boolean().optional().describe('是否检查重复，默认 true'),
        similarityThreshold: z.number().min(0).max(1).optional().describe('重复提醒阈值，默认 0.75'),
    }, async ({ recipeText, recipe, checkDuplicate = true, similarityThreshold = 0.75 }) => {
        try {
            if (!recipe && !recipeText?.trim())
                throw new Error('recipe 和 recipeText 至少需要传入一个');
            const parsedRecipe = recipe
                ? parseRecipeFromInput(recipe)
                : parseRecipeText(recipeText);
            const similarRecipes = checkDuplicate
                ? recipes
                    .map((existing) => ({
                    recipe: existing,
                    similarity: calculateSimilarity(parsedRecipe.name, existing.name),
                }))
                    .filter((item) => item.similarity >= similarityThreshold)
                    .sort((a, b) => b.similarity - a.similarity)
                : [];
            const duplicate = similarRecipes.length
                ? {
                    exists: true,
                    highestSimilarity: similarRecipes[0].similarity,
                    similarRecipes: similarRecipes.map((item) => ({
                        id: item.recipe.id,
                        name: item.recipe.name,
                        category: item.recipe.category,
                        categoryName: item.recipe.categoryName,
                        similarity: Math.round(item.similarity * 100) / 100,
                    })),
                }
                : null;
            if (duplicate && duplicate.highestSimilarity >= 0.9) {
                return jsonResult({
                    success: false,
                    error: '食谱已存在',
                    message: `检测到高度相似的食谱（${Math.round(duplicate.highestSimilarity * 100)}%），已拒绝创建。`,
                    duplicate,
                    existingRecipe: duplicate.similarRecipes[0],
                });
            }
            return jsonResult({
                success: true,
                schemaVersion: 2,
                recipe: parsedRecipe,
                message: `V2 食谱“${parsedRecipe.name}”已规范化`,
                ...(duplicate ? { duplicate } : {}),
            });
        }
        catch (error) {
            return {
                ...jsonResult({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }),
                isError: true,
            };
        }
    });
}
function jsonResult(value) {
    return {
        content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    };
}
