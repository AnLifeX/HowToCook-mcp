// 远程菜谱JSON文件URL
const RECIPES_URL = 'https://weilei.site/all_recipes.json';
// 从远程URL获取数据的异步函数
export async function fetchRecipes() {
    try {
        // 使用fetch API获取远程数据
        const response = await fetch(RECIPES_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // 解析JSON数据
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error('获取远程菜谱数据失败:', error);
        // 直接返回空数组，不尝试使用本地备份
        return [];
    }
}
// 获取所有分类
export function getAllCategories(recipes) {
    const categories = new Set();
    recipes.forEach((recipe) => {
        if (recipe.category) {
            categories.add(recipe.category);
        }
    });
    return Array.from(categories);
}
