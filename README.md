# HowToCook MCP Server

简体中文 | [English](./README_EN.md)

仓库：[AnLifeX/HowToCook-mcp](https://github.com/AnLifeX/HowToCook-mcp)。当前服务版本为 `0.3.0`，提供菜谱查询、随机菜单、每周膳食计划和 V2 菜谱规范化工具。

## 数据与功能

服务启动时读取本地 `build/data/all_recipes.json`，不会自动从远端同步，也不会调用大模型 API。当前内置数据版本为 `2026.07.28.1`，包含 367 份 V2 菜谱，使用稳定 UUID，并保留旧 ID。

菜谱来源为 [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)，V2 数据由 [AnLifeX/HowToCook-assets](https://github.com/AnLifeX/HowToCook-assets) 整理。本服务可独立部署；Flutter App 从 0.5.0 起使用 App 内置菜谱工具，不再依赖此 MCP 服务。

| 工具名称 | 参数 | 实际行为 |
| --- | --- | --- |
| `mcp_howtocook_getAllRecipes` | 无必填参数 | 返回全量索引：UUID、名称、简介、分类、难度、热量；不返回完整步骤，无分页。 |
| `mcp_howtocook_getRecipesByCategory` | `category` | 按分类 ID 或中文名精确筛选，返回摘要与食材用量。 |
| `mcp_howtocook_getRecipeById` | `query` | 依次匹配 UUID / 旧 ID、完整名称、名称子串；返回首个匹配的完整 V2 菜谱。名称未匹配时可返回简介匹配候选，最多 5 条。 |
| `mcp_howtocook_recommendMeals` | `peopleCount`，可选 `allergies`、`avoidItems` | 按食材名称子串过滤后随机生成 7 天三餐和购物清单；人数必须为 1–10 的整数，候选不足时餐次可能不满。 |
| `mcp_howtocook_whatToEat` | `peopleCount` | 按人数随机组合荤菜和其他类别菜品；人数必须为 1–10 的整数，不支持忌口或过敏原参数。 |
| `mcp_howtocook_createRecipe` | `recipe` 或 `recipeText`；可选 `checkDuplicate`、`similarityThreshold` | 将客户端提供的菜谱规范化为 V2，并按名称相似度检查重复；只返回结果，不写入文件或加入查询库。 |

分类：`aquatic`（水产）、`breakfast`（早餐）、`condiment`（调料）、`dessert`（甜品）、`drink`（饮料）、`meat_dish`（荤菜）、`semi-finished`（半成品）、`soup`（汤粥）、`staple`（主食）、`vegetable_dish`（素菜）。

每周推荐不是营养优化或过敏安全判定。购物清单保留原始用量示例及涉及菜谱，不会换算单位、按人数缩放食材用量或汇总为精确采购重量。工具返回 MCP 文本内容，其中的 `text` 为 JSON 字符串。

## 从源码启动

要求：Node.js ≥ 18（与 `package.json` 和锁定依赖一致）、npm。

```bash
git clone https://github.com/AnLifeX/HowToCook-mcp.git
cd HowToCook-mcp
npm ci
npm run build
npm start
```

`npm run build` 编译 TypeScript，并将 `src/data/all_recipes.json` 复制到运行目录。默认监听 `0.0.0.0:9000`，使用 HTTP；服务没有内置身份认证，向外开放时需在部署入口配置访问控制。

### 传输与端点

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `--transport <http\|sse\|stdio>` | `http` | 也可通过环境变量 `transport` 或 `TRANSPORT` 设置。 |
| `--port <number>` | `9000` | 也可通过环境变量 `PORT` 或 `port` 设置，适用于 HTTP / SSE。 |

环境变量优先于命令行参数；同名大小写变量的优先顺序如上。服务不会自动加载 `.env` 文件，需由启动环境设置变量。

```bash
node build/index.js --transport http --port 8080
```

HTTP 和 SSE 模式均开放以下路由：

- `http://localhost:9000/mcp`：Streamable HTTP MCP 端点。
- `http://localhost:9000/sse`：SSE 连接端点；消息通过 `/messages?sessionId=...` 提交。
- `http://localhost:9000/health`：健康状态、传输方式、Schema 与数据版本。
- `http://localhost:9000/info`：服务版本、数据版本、端点及菜谱数量。

可用脚本：`npm run start:http`、`npm run start:sse`、`npm run start:stdio`。环境变量仍会覆盖这些脚本中的传输参数。

### 连接 MCP 客户端

推荐在支持 Streamable HTTP 的客户端中配置服务 URL `http://localhost:9000/mcp`。远端部署时替换为自己的服务地址；具体配置格式以客户端为准。

本地 stdio 启动示例（将路径替换为实际绝对路径）：

```json
{
  "mcpServers": {
    "howtocook-mcp": {
      "command": "node",
      "args": ["D:/path/HowToCook-mcp/build/index.js", "--transport", "stdio"]
    }
  }
}
```

当前源码还会将启动及数据加载日志写到 stdout，可能干扰严格解析 stdio 的客户端；建议优先使用 HTTP，stdio 兼容性需单独验证。客户端进程的 `transport` / `TRANSPORT` 环境变量也可能覆盖上述参数。

## 更新内置 V2 数据

将 `HowToCook-assets` 放在本仓库同级目录，再执行：

```bash
npm run sync:v2-data
npm run build
```

也可显式指定静态仓库目录：

```bash
npm run sync:v2-data -- D:/path/HowToCook-assets
npm run build
```

同步脚本读取该本地仓库的 `channels/v2-stable.json` 和对应 manifest，将菜谱打包到 `src/data/all_recipes.json`。构建后重启服务才能加载新数据；脚本不会自动拉取 Git 远端。

## 调用示例

以下为工具参数，不是完整 MCP 请求报文：

```json
{"query": "宫保鸡丁"}
```

```json
{"category": "水产"}
```

```json
{"peopleCount": 3, "allergies": ["虾"], "avoidItems": ["香菜"]}
```

`createRecipe` 优先接收结构化 `recipe`，至少需要 `name`、非空 `ingredients` 和非空 `steps`：

```json
{
  "recipe": {
    "name": "示例炒青菜",
    "description": "简单的家常青菜",
    "category": "vegetable_dish",
    "categoryName": "素菜",
    "ingredients": [
      {"name": "青菜", "text": "青菜 300 克"},
      {"name": "油", "text": "油 10 毫升"},
      {"name": "盐", "text": "盐 2 克"}
    ],
    "steps": [
      {"description": "青菜洗净沥干。"},
      {"description": "热锅加油，放入青菜炒熟，加盐调味。"}
    ]
  }
}
```

可选字段包括简介、难度、热量、必备项、工具、计算说明、贴士和警告。默认检查名称重复，提醒阈值为 `0.75`；通过该阈值筛选的候选若相似度 ≥ `0.9` 会拒绝创建。`checkDuplicate: false` 可关闭检查。菜谱内容由调用方提供，服务不会自行生成或持久化菜谱。

## DXT 与许可

仓库保留 `manifest.json` 和预构建的 `HowToCook-mcp.dxt`，包内清单和文档已同步更新。本次未重新构建运行代码或验证桌面客户端安装；后续修改源码或清单时需同步更新该文件。本文以源码启动方式为准。

`package.json` 和扩展清单声明的代码许可为 ISC；菜谱数据来源见上方链接。
