import { randomUUID } from 'crypto';
const categoryByName = {
    '水产': 'aquatic',
    '早餐': 'breakfast',
    '调料': 'condiment',
    '酱料和其它材料': 'condiment',
    '甜品': 'dessert',
    '饮料': 'drink',
    '饮品': 'drink',
    '荤菜': 'meat_dish',
    '半成品': 'semi-finished',
    '半成品加工': 'semi-finished',
    '汤': 'soup',
    '汤粥': 'soup',
    '汤羹': 'soup',
    '主食': 'staple',
    '素菜': 'vegetable_dish',
    '其他': 'other',
};
const categoryNames = Object.fromEntries(Object.entries(categoryByName).map(([name, id]) => [id, name]));
categoryNames.condiment = '调料';
categoryNames.drink = '饮料';
categoryNames['semi-finished'] = '半成品';
categoryNames.soup = '汤粥';
export function parseRecipeText(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            return parseRecipeFromInput(JSON.parse(trimmed));
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                // 不是 JSON，继续按文本模板解析。
            }
            else {
                throw error;
            }
        }
    }
    return parseRecipeFromText(text);
}
export function parseRecipeFromInput(data) {
    if (!data.name?.trim())
        throw new Error('食谱名称不能为空');
    if (!data.ingredients?.length)
        throw new Error('用量与计算中至少需要一种食材');
    if (!data.steps?.length)
        throw new Error('操作板块至少需要一条内容');
    const category = normalizeCategory(data.category, data.categoryName);
    const categoryName = data.categoryName || categoryNames[category] || data.category || '其他';
    const tools = uniqueStrings(data.tools || []);
    const ingredients = data.ingredients.map(normalizeIngredient);
    const requirements = (data.requirements || []).map(normalizeRequirement);
    if (!requirements.length) {
        requirements.push(...ingredients.map((item) => ({
            text: item.name,
            markdown: item.name,
            kind: 'ingredient',
        })), ...tools.map((tool) => ({ text: tool, markdown: tool, kind: 'tool' })));
    }
    const steps = data.steps.map(normalizeStep);
    const calculationNotes = uniqueStrings(data.calculationNotes || []);
    const id = randomUUID();
    return {
        schemaVersion: 2,
        id,
        legacyIds: [],
        name: data.name.trim().replace(/的做法$/, ''),
        description: data.description?.trim() || null,
        category,
        categoryName,
        difficulty: clampDifficulty(data.difficulty),
        estimatedCaloriesKcal: normalizePositiveInt(data.estimatedCaloriesKcal),
        requirements,
        requirementsMarkdown: requirements.map((item) => `* ${item.markdown}`).join('\n'),
        ingredients,
        tools,
        calculationMarkdown: [
            ...calculationNotes,
            ...ingredients.map((item) => `* ${item.text}`),
        ].join('\n'),
        calculationNotes,
        steps,
        operationMarkdown: steps.map((step) => step.description).join('\n'),
        tips: data.tips?.trim() || null,
        warnings: uniqueStrings(data.warnings || []),
        additionalMarkdown: null,
        images: [],
        externalImages: [],
        source: 'mcp-created',
        hash: id,
    };
}
function parseRecipeFromText(text) {
    const lines = text.split(/\r?\n/);
    const input = { name: '', ingredients: [], steps: [] };
    const requirements = [];
    const tools = [];
    const calculationNotes = [];
    const warnings = [];
    const descriptionLines = [];
    const tipLines = [];
    let section = '';
    let tableHeaders = [];
    for (const rawLine of lines) {
        const raw = rawLine.trim();
        if (!raw)
            continue;
        const headingMatch = raw.match(/^#{1,6}\s*(.+)$/);
        const line = (headingMatch?.[1] || raw).trim();
        const normalized = line.replace(/[：:]$/, '').trim();
        if (headingMatch) {
            if (!input.name && raw.startsWith('# ') && !isSectionTitle(normalized)) {
                input.name = normalized.replace(/的做法$/, '');
                continue;
            }
            const nextSection = detectSection(normalized);
            if (nextSection) {
                section = nextSection;
                tableHeaders = [];
                continue;
            }
        }
        const label = line.match(/^([^：:]+)[：:]\s*(.*)$/);
        if (label) {
            const key = label[1].trim();
            const value = label[2].trim();
            if (/^(?:菜名|名称|食谱名称)$/.test(key)) {
                input.name = value.replace(/的做法$/, '');
                continue;
            }
            if (/^(?:菜谱)?简介$/.test(key)) {
                if (value)
                    descriptionLines.push(value);
                section = 'description';
                continue;
            }
            if (key.includes('难度')) {
                input.difficulty = parseDifficulty(value);
                continue;
            }
            if (key.includes('分类')) {
                input.categoryName = value;
                continue;
            }
            if (key.includes('热量') || key.includes('卡路里')) {
                input.estimatedCaloriesKcal = parseFirstInt(value);
                continue;
            }
            const nextSection = detectSection(key);
            if (nextSection) {
                section = nextSection;
                if (value)
                    addSectionLine(section, value, input, requirements, tools, calculationNotes, tipLines, warnings);
                continue;
            }
        }
        if (!input.name && !isListLine(line)) {
            input.name = line.replace(/[【】]/g, '').replace(/的做法$/, '');
            continue;
        }
        if (section === 'calculation' && line.includes('|')) {
            const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
            if (!cells.length || cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
                continue;
            if (!tableHeaders.length && cells.some((cell) => /(?:原料|食材|用量|备注)/.test(cell))) {
                tableHeaders = cells;
                continue;
            }
            const table = Object.fromEntries(cells.map((cell, index) => [tableHeaders[index] || `列${index + 1}`, cell]));
            input.ingredients.push({ name: cells[0], text: cells.join(' '), optional: false, source: 'calculation-table', table });
            continue;
        }
        if (section === 'description')
            descriptionLines.push(line);
        else
            addSectionLine(section, line, input, requirements, tools, calculationNotes, tipLines, warnings);
    }
    input.description = descriptionLines.join('\n');
    input.requirements = requirements;
    input.tools = tools;
    input.calculationNotes = calculationNotes;
    input.tips = tipLines.join('\n');
    input.warnings = warnings;
    return parseRecipeFromInput(input);
}
function addSectionLine(section, value, input, requirements, tools, calculationNotes, tips, warnings) {
    const clean = stripBullet(value);
    if (!clean)
        return;
    if (section === 'requirements') {
        const kind = looksLikeTool(clean) ? 'tool' : 'ingredient';
        requirements.push({ text: clean, markdown: clean, kind });
        if (kind === 'tool')
            tools.push(clean);
    }
    else if (section === 'tools') {
        tools.push(clean);
    }
    else if (section === 'calculation' || section === 'ingredients') {
        if (isListLine(value))
            input.ingredients.push(clean);
        else
            calculationNotes.push(clean);
    }
    else if (section === 'steps') {
        input.steps.push(clean.replace(/^[\d①-⑳]+[.、：:\s]+/, ''));
    }
    else if (section === 'tips')
        tips.push(clean);
    else if (section === 'warnings')
        warnings.push(clean);
}
function detectSection(title) {
    if (/(?:必备原料)(?:和|与)?工具/.test(title))
        return 'requirements';
    if (/^(?:原料|食材|配料)$/.test(title))
        return 'ingredients';
    if (title.includes('用量') || title === '计算')
        return 'calculation';
    if (title.includes('工具'))
        return 'tools';
    if (/^(?:操作|做法|步骤|制作步骤)$/.test(title))
        return 'steps';
    if (title.includes('简介'))
        return 'description';
    if (/(?:小贴士|贴士|tips?)/i.test(title))
        return 'tips';
    if (/(?:注意|警告|warnings?)/i.test(title))
        return 'warnings';
    return '';
}
function isSectionTitle(value) {
    return Boolean(detectSection(value));
}
function normalizeIngredient(value) {
    if (typeof value === 'string') {
        const text = value.trim();
        return { name: ingredientName(text), text, optional: false, source: 'mcp-input' };
    }
    const text = String(value.text || value.name || '').trim();
    if (!text)
        throw new Error('食材内容不能为空');
    return {
        name: String(value.name || ingredientName(text)).trim(),
        text,
        optional: Boolean(value.optional),
        source: value.source || 'mcp-input',
        ...(value.table && Object.keys(value.table).length ? { table: value.table } : {}),
    };
}
function normalizeRequirement(value) {
    if (typeof value === 'string')
        return { text: value.trim(), markdown: value.trim(), kind: 'unknown' };
    const text = String(value.text || value.markdown || '').trim();
    return { text, markdown: String(value.markdown || text), group: value.group, kind: value.kind || 'unknown' };
}
function normalizeStep(value) {
    if (typeof value === 'string')
        return { kind: 'step', description: value.trim() };
    return {
        kind: value.kind || 'step',
        title: value.title,
        description: String(value.description || '').trim(),
    };
}
function normalizeCategory(category, categoryName) {
    if (category && Object.values(categoryByName).includes(category))
        return category;
    return categoryByName[categoryName || ''] || categoryByName[category || ''] || category || 'other';
}
function parseDifficulty(value) {
    const stars = (value.match(/[⭐★]/g) || []).length;
    return stars || parseFirstInt(value) || 3;
}
function clampDifficulty(value) {
    return Math.min(5, Math.max(1, Math.round(value || 3)));
}
function normalizePositiveInt(value) {
    if (value == null || !Number.isFinite(value) || value <= 0)
        return null;
    return Math.round(value);
}
function parseFirstInt(value) {
    const match = value.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : undefined;
}
function ingredientName(text) {
    return text.split(/\s+/)[0] || text;
}
function stripBullet(value) {
    return value.replace(/^[*•-]\s*/, '').trim();
}
function isListLine(value) {
    return /^[*•-]|^[\d①-⑳]+[.、：:\s]+/.test(value.trim());
}
function looksLikeTool(value) {
    return ['锅', '刀', '砧板', '烤箱', '微波炉', '打蛋器', '电饭煲', '料理机', '容器'].some((word) => value.includes(word));
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
export function calculateSimilarity(name1, name2) {
    const s1 = name1.toLowerCase().replace(/的做法|[【】]/g, '').trim();
    const s2 = name2.toLowerCase().replace(/的做法|[【】]/g, '').trim();
    if (s1 === s2)
        return 1;
    if (s1.includes(s2) || s2.includes(s1))
        return 0.85;
    const distance = levenshteinDistance(s1, s2);
    return Math.max(s1.length, s2.length) === 0 ? 1 : 1 - distance / Math.max(s1.length, s2.length);
}
function levenshteinDistance(str1, str2) {
    const dp = Array.from({ length: str1.length + 1 }, () => Array(str2.length + 1).fill(0));
    for (let i = 0; i <= str1.length; i++)
        dp[i][0] = i;
    for (let j = 0; j <= str2.length; j++)
        dp[0][j] = j;
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            dp[i][j] = str1[i - 1] === str2[j - 1]
                ? dp[i - 1][j - 1]
                : Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
    }
    return dp[str1.length][str2.length];
}
