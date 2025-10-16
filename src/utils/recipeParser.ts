import { Recipe, Ingredient, Step } from '../types/index.js';

/**
 * 结构化 JSON 输入接口
 */
interface RecipeJsonInput {
  name: string;
  category?: string;
  categoryName?: string;
  difficulty?: number;
  ingredients: string[];
  tools?: string[];
  steps: string[];
  tips?: string;
}

/**
 * 解析自然语言格式的食谱文本或结构化 JSON
 * 自动检测输入格式并调用相应的解析器
 */
export function parseRecipeText(text: string): Recipe {
  // 尝试解析为 JSON
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const jsonData: RecipeJsonInput = JSON.parse(trimmed);
      return parseRecipeFromJson(jsonData);
    }
  } catch (error) {
    // 不是有效的 JSON，继续使用文本解析
  }

  // 使用自然语言文本解析
  return parseRecipeFromText(text);
}

/**
 * 从结构化 JSON 解析食谱
 */
function parseRecipeFromJson(data: RecipeJsonInput): Recipe {
  // 验证必填字段
  if (!data.name) {
    throw new Error('食谱名称不能为空');
  }

  if (!data.ingredients || data.ingredients.length === 0) {
    throw new Error('食材列表不能为空');
  }

  if (!data.steps || data.steps.length === 0) {
    throw new Error('制作步骤不能为空');
  }

  // 处理分类
  const category = data.categoryName || data.category || '其他';

  // 处理难度
  const difficulty = Math.min(Math.max(data.difficulty || 3, 1), 5);

  // 处理食材
  const ingredients: Ingredient[] = data.ingredients.map(ing => ({
    name: ing,
    quantity: null,
    unit: null,
    text_quantity: ing,
    notes: ''
  }));

  // 处理步骤
  const steps: Step[] = data.steps.map((stepDesc, index) => ({
    step: index + 1,
    description: stepDesc
  }));

  // 处理小贴士
  const additionalNotes: string[] = [];
  if (data.tips) {
    const tips = data.tips.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    additionalNotes.push(...tips);
  }

  // 生成唯一 ID
  const timestamp = Date.now();
  const id = `custom-${sanitizeId(data.name)}-${timestamp}`;

  // 构建描述文本
  const description = buildDescription(data.name, category, difficulty, data.tools || []);

  return {
    id,
    name: data.name.includes('的做法') ? data.name : `${data.name}的做法`,
    description,
    source_path: `custom/${sanitizeId(data.name)}.md`,
    image_path: null,
    category,
    difficulty,
    tags: [category],
    servings: 1,
    ingredients,
    steps,
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: null,
    additional_notes: additionalNotes
  };
}

/**
 * 从自然语言文本解析食谱
 * 支持的格式：
 * 【名称】
 * 难度: ⭐⭐ 或 难度: 2
 * 分类: 水产
 * 食材:
 * • 食材名称 数量
 * 所需工具: (可选)
 * • 工具名称
 * 制作步骤:
 * 1. 步骤描述
 * 小贴士: (可选)
 * - 贴士内容
 */
function parseRecipeFromText(text: string): Recipe {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let name = '';
  let difficulty = 3; // 默认难度
  let category = '其他'; // 默认分类
  const ingredients: Ingredient[] = [];
  const steps: Step[] = [];
  const additionalNotes: string[] = [];
  let tools: string[] = [];

  let currentSection = '';

  for (const line of lines) {
    // 解析名称（【】或直接作为第一行）
    if (line.startsWith('【') && line.includes('】')) {
      name = line.replace(/【|】/g, '').trim();
      continue;
    }

    // 如果第一个非空行没有【】，就作为名称
    if (!name && !line.includes(':') && !line.match(/^[•\-\d]/)) {
      name = line.trim();
      continue;
    }

    // 解析难度
    if (line.includes('难度')) {
      const difficultyMatch = line.match(/难度[：:]\s*([⭐★]+|\d+)/);
      if (difficultyMatch) {
        const diffStr = difficultyMatch[1];
        if (/[⭐★]/.test(diffStr)) {
          difficulty = diffStr.length; // 星星数量
        } else {
          difficulty = parseInt(diffStr, 10);
        }
      }
      continue;
    }

    // 解析分类
    if (line.includes('分类')) {
      const categoryMatch = line.match(/分类[：:]\s*(.+)/);
      if (categoryMatch) {
        category = categoryMatch[1].trim();
      }
      continue;
    }

    // 检测当前所在的区块
    if (line.includes('食材') && line.includes(':')) {
      currentSection = 'ingredients';
      continue;
    }

    if (line.includes('工具') && line.includes(':')) {
      currentSection = 'tools';
      continue;
    }

    if (line.includes('步骤') && line.includes(':')) {
      currentSection = 'steps';
      continue;
    }

    if (line.includes('小贴士') || line.includes('贴士') || line.includes('注意')) {
      currentSection = 'notes';
      continue;
    }

    // 根据当前区块解析内容
    if (currentSection === 'ingredients') {
      // 食材行（以 • 或 - 开头）
      if (line.match(/^[•\-]/)) {
        const ingredientText = line.replace(/^[•\-]\s*/, '').trim();
        ingredients.push({
          name: ingredientText,
          quantity: null,
          unit: null,
          text_quantity: ingredientText,
          notes: ''
        });
      }
    }

    if (currentSection === 'tools') {
      // 工具行（以 • 或 - 开头）
      if (line.match(/^[•\-]/)) {
        const toolText = line.replace(/^[•\-]\s*/, '').trim();
        tools.push(toolText);
      }
    }

    if (currentSection === 'steps') {
      // 步骤行（以数字开头）
      const stepMatch = line.match(/^(\d+)[\.、\s]+(.+)/);
      if (stepMatch) {
        steps.push({
          step: parseInt(stepMatch[1], 10),
          description: stepMatch[2].trim()
        });
      }
    }

    if (currentSection === 'notes') {
      // 小贴士行（以 - 开头或直接文本）
      if (line.match(/^[•\-]/)) {
        additionalNotes.push(line.replace(/^[•\-]\s*/, '').trim());
      } else if (line && !line.includes(':')) {
        additionalNotes.push(line.trim());
      }
    }
  }

  // 验证必填字段
  if (!name) {
    throw new Error('食谱名称不能为空');
  }

  if (ingredients.length === 0) {
    throw new Error('食材列表不能为空');
  }

  if (steps.length === 0) {
    throw new Error('制作步骤不能为空');
  }

  // 生成唯一 ID
  const timestamp = Date.now();
  const id = `custom-${sanitizeId(name)}-${timestamp}`;

  // 构建描述文本
  const description = buildDescription(name, category, difficulty, tools);

  return {
    id,
    name: name.includes('的做法') ? name : `${name}的做法`,
    description,
    source_path: `custom/${sanitizeId(name)}.md`,
    image_path: null,
    category,
    difficulty: Math.min(Math.max(difficulty, 1), 5), // 限制在 1-5 之间
    tags: [category],
    servings: 1,
    ingredients,
    steps,
    prep_time_minutes: null,
    cook_time_minutes: null,
    total_time_minutes: null,
    additional_notes: additionalNotes
  };
}

/**
 * 构建食谱描述文本（Markdown 格式）
 */
function buildDescription(name: string, category: string, difficulty: number, tools: string[]): string {
  const fullName = name.includes('的做法') ? name : `${name}的做法`;
  let desc = `# ${fullName}\n\n`;

  desc += `预估烹饪难度：${'★'.repeat(difficulty)}\n\n`;
  desc += `分类：${category}\n\n`;

  if (tools.length > 0) {
    desc += `## 所需工具\n\n`;
    tools.forEach(tool => {
      desc += `- ${tool}\n`;
    });
    desc += '\n';
  }

  desc += `这是一道由 AI 生成并经过规范化处理的食谱。\n`;

  return desc;
}

/**
 * 清理 ID 中的特殊字符
 */
function sanitizeId(text: string): string {
  return text
    .replace(/[【】\s\/\\:：]/g, '-')
    .replace(/的做法$/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 检查食谱名称的相似度
 * 返回 0-1 之间的相似度分数
 */
export function calculateSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().replace(/的做法|【|】/g, '').trim();
  const s2 = name2.toLowerCase().replace(/的做法|【|】/g, '').trim();

  // 精确匹配
  if (s1 === s2) return 1.0;

  // 包含关系
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  // Levenshtein 距离
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  if (maxLength === 0) return 1.0;

  return 1 - distance / maxLength;
}

/**
 * 计算 Levenshtein 距离（编辑距离）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 删除
          dp[i][j - 1] + 1,      // 插入
          dp[i - 1][j - 1] + 1   // 替换
        );
      }
    }
  }

  return dp[len1][len2];
}
