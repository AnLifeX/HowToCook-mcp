import { Recipe } from '../types/index.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 本地菜谱JSON文件路径
const LOCAL_RECIPES_PATH = join(__dirname, 'all_recipes.json')

// 从本地文件加载数据的函数
export async function fetchRecipes(): Promise<Recipe[]> {
	try {
		// 从本地文件读取数据
		const data = readFileSync(LOCAL_RECIPES_PATH, 'utf-8')
		const recipes = JSON.parse(data)
		console.log(`✅ 成功从本地加载 ${recipes.length} 个菜谱`)
		return recipes as Recipe[]
	} catch (error) {
		console.error('❌ 加载本地菜谱数据失败:', error)
		return []
	}
}

// 获取所有分类
export function getAllCategories(recipes: Recipe[]): string[] {
	const categories = new Set<string>()
	recipes.forEach((recipe) => {
		if (recipe.category) {
			categories.add(recipe.category)
		}
	})
	return Array.from(categories)
}
