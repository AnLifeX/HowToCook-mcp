import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(projectRoot, 'src', 'data', 'all_recipes.json');
const target = join(projectRoot, 'build', 'data', 'all_recipes.json');
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`已复制 V2 菜谱数据 -> ${target}`);
