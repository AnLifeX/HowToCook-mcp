export function simplifyRecipe(recipe) {
    return {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        category: recipe.category,
        categoryName: recipe.categoryName,
        difficulty: recipe.difficulty,
        estimatedCaloriesKcal: recipe.estimatedCaloriesKcal,
        ingredients: recipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            text: ingredient.text,
            optional: ingredient.optional,
        })),
    };
}
export function simplifyRecipeNameOnly(recipe) {
    return {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        category: recipe.category,
        categoryName: recipe.categoryName,
        difficulty: recipe.difficulty,
        estimatedCaloriesKcal: recipe.estimatedCaloriesKcal,
    };
}
/** V2 保留原始用量文本，不对不同单位做错误求和。 */
export function processRecipeIngredients(recipe, ingredientMap) {
    recipe.ingredients.forEach((ingredient) => {
        const key = ingredient.name.toLowerCase();
        const existing = ingredientMap.get(key);
        if (!existing) {
            ingredientMap.set(key, {
                amountExamples: [ingredient.text],
                recipeCount: 1,
                recipes: [recipe.name],
            });
            return;
        }
        if (!existing.amountExamples.includes(ingredient.text)) {
            existing.amountExamples.push(ingredient.text);
        }
        existing.recipeCount += 1;
        if (!existing.recipes.includes(recipe.name))
            existing.recipes.push(recipe.name);
    });
}
export function categorizeIngredients(ingredients, shoppingPlan) {
    const spiceKeywords = ['盐', '糖', '酱油', '醋', '料酒', '香料', '胡椒', '孜然', '辣椒', '花椒', '姜', '蒜', '葱', '调味'];
    const freshKeywords = ['肉', '鱼', '虾', '蛋', '奶', '菜', '豆腐', '水产', '番茄', '水果', '菇', '木耳'];
    const pantryKeywords = ['米', '面', '粉', '油', '酒', '醋', '糖', '盐', '酱', '豆', '干', '罐头', '燕麦'];
    ingredients.forEach((ingredient) => {
        const name = ingredient.name.toLowerCase();
        if (spiceKeywords.some((keyword) => name.includes(keyword)))
            shoppingPlan.spices.push(ingredient.name);
        else if (freshKeywords.some((keyword) => name.includes(keyword)))
            shoppingPlan.fresh.push(ingredient.name);
        else if (pantryKeywords.some((keyword) => name.includes(keyword)))
            shoppingPlan.pantry.push(ingredient.name);
        else
            shoppingPlan.others.push(ingredient.name);
    });
}
