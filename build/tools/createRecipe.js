import { z } from "zod";
import { parseRecipeText, calculateSimilarity } from "../utils/recipeParser.js";
/**
 * 注册创建食谱工具
 * 接收自然语言格式的食谱文本，解析并规范化为 JSON 格式
 * 同时检查是否与现有食谱重复
 */
export function registerCreateRecipeTool(server, recipes) {
    server.tool("mcp_howtocook_createRecipe", `创建新的食谱。接收自然语言格式的食谱文本，自动解析并规范化为标准 JSON 格式。

支持的输入格式：
【食谱名称】

难度: ⭐⭐ 或 难度: 2
难度等级说明（1-5星，必须是整数）：
  ⭐ (1星) - 非常简单，几乎不需要烹饪技巧，10分钟内完成（如：拌面、煮泡面）
  ⭐⭐ (2星) - 简单，基础烹饪技巧，15-30分钟（如：番茄炒蛋、煎蛋）
  ⭐⭐⭐ (3星) - 中等，需要一定经验，30-60分钟（如：红烧肉、宫保鸡丁）
  ⭐⭐⭐⭐ (4星) - 较难，需要较好的烹饪技巧和经验（如：佛跳墙、烤鸭）
  ⭐⭐⭐⭐⭐ (5星) - 非常难，需要专业技巧和特殊设备（如：分子料理、法式甜点）

分类: 水产/荤菜/素菜/早餐/主食/半成品加工/汤/甜品/酱料和其它材料

食材:
• 食材名称 数量单位（如：西红柿 500克、鸡蛋 3个）
• 食材名称 数量单位

所需工具: (可选)
• 工具名称

制作步骤:
1. 步骤描述（详细说明操作和时间）
2. 步骤描述

小贴士: (可选)
- 贴士内容

该工具会自动检查与现有食谱的重复度，如果相似度超过阈值会返回警告。`, {
        recipeText: z.string().describe('自然语言格式的食谱文本'),
        checkDuplicate: z.boolean().optional().describe('是否检查重复（默认 true）'),
        similarityThreshold: z.number().min(0).max(1).optional().describe(`相似度检测阈值（0-1，默认 0.75）。
      用于检测相似食谱并显示警告。
      注意：相似度 >= 90% 的食谱会被自动拒绝创建，无论此参数如何设置。
      建议值：0.7-0.8（更宽松）/ 0.75（标准）/ 0.8-0.85（更严格）`)
    }, async ({ recipeText, checkDuplicate = true, similarityThreshold = 0.75 }) => {
        try {
            // 解析食谱文本
            const parsedRecipe = parseRecipeText(recipeText);
            // 检查重复
            let duplicateInfo = null;
            if (checkDuplicate) {
                const similarRecipes = [];
                for (const existingRecipe of recipes) {
                    const similarity = calculateSimilarity(parsedRecipe.name, existingRecipe.name);
                    if (similarity >= similarityThreshold) {
                        similarRecipes.push({ recipe: existingRecipe, similarity });
                    }
                }
                // 按相似度降序排序
                similarRecipes.sort((a, b) => b.similarity - a.similarity);
                if (similarRecipes.length > 0) {
                    duplicateInfo = {
                        exists: true,
                        similarRecipes: similarRecipes.map(item => ({
                            name: item.recipe.name,
                            id: item.recipe.id,
                            category: item.recipe.category,
                            similarity: Math.round(item.similarity * 100) / 100
                        })),
                        highestSimilarity: similarRecipes[0].similarity
                    };
                }
            }
            // 检查是否有高相似度的重复食谱（>= 90% 自动拒绝）
            if (duplicateInfo && duplicateInfo.highestSimilarity >= 0.9) {
                // 高相似度（>= 90%），直接拒绝创建
                const existingRecipeInfo = duplicateInfo.similarRecipes[0];
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: "食谱已存在",
                                message: `检测到高度相似的食谱（相似度 ${Math.round(duplicateInfo.highestSimilarity * 100)}%），已拒绝创建重复食谱。`,
                                duplicate: duplicateInfo,
                                existingRecipe: existingRecipeInfo,
                                suggestion: `建议使用现有食谱：${existingRecipeInfo.name}（ID: ${existingRecipeInfo.id}）`,
                                note: "相似度 >= 90% 会自动拒绝创建。如果确实需要创建相似食谱，请降低 similarityThreshold 参数。",
                                nextAction: `请使用 mcp_howtocook_getRecipeById 工具查询完整食谱信息，参数为：${existingRecipeInfo.id}`
                            }, null, 2)
                        }
                    ]
                };
            }
            // 检查中等相似度（达到用户设定的阈值但 < 90%）
            if (duplicateInfo && duplicateInfo.highestSimilarity >= similarityThreshold && duplicateInfo.highestSimilarity < 0.9) {
                // 中等相似度，提示用户但仍然允许创建
                const shouldWarn = duplicateInfo.highestSimilarity >= 0.8; // 80% 以上给出强烈警告
                if (shouldWarn) {
                    // 给出警告但不拒绝
                }
            }
            // 构建返回结果
            const result = {
                success: true,
                recipe: parsedRecipe,
                message: `食谱 "${parsedRecipe.name}" 已成功创建并规范化`
            };
            // 如果有中低相似度的警告（< 90%）
            if (duplicateInfo) {
                result.duplicate = duplicateInfo;
                result.message += `\n\n⚠️ 警告：检测到相似食谱`;
                result.message += `\n最高相似度：${Math.round(duplicateInfo.highestSimilarity * 100)}%`;
                result.message += `\n相似食谱数量：${duplicateInfo.similarRecipes.length}`;
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: error.message || '解析食谱时发生错误',
                            details: error.stack
                        }, null, 2)
                    }
                ],
                isError: true
            };
        }
    });
}
