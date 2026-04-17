# Mentor Agent

一个基于 AI 的智能导师系统，提供个性化学习规划、知识讲解、练习批改和学习进度跟踪。采用多 Agent 协作架构，支持完全本地运行。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

## 特点

- 🤖 **多 Agent 协作**：专业分工，高效协作
- 🔒 **隐私优先**：完全本地运行，数据加密存储
- 🎯 **个性化学习**：基于用户画像的定制化学习路径
- 📊 **可视化进度**：甘特图、成长地图、学习报告
- 🔌 **灵活集成**：支持多种 AI 模型和 RAG 知识库
- 🚀 **一键启动**：运行 `./start.sh` 即可完成所有配置和启动

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [配置说明](#配置说明)
- [架构设计](#架构设计)
- [测试](#测试)
- [部署](#部署)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [路线图](#路线图)

## 功能特性

### 核心功能

#### 学习规划与管理
- **成长地图**：AI 生成结构化学习路径，包含阶段、任务和时间表
- **学习调度**：智能安排每日学习计划，合理分配学习时间
- **进度跟踪**：甘特图可视化展示学习进度，实时更新任务状态

#### AI 导师系统
- **智能对话**：与 AI 导师自然对话，获取学习建议和答疑解惑
- **顾问咨询**：专业顾问提供学习规划和职业发展建议
- **课程生成**：自动生成结构化的每日课程和学习材料
- **练习批改**：智能生成练习题并提供详细反馈（规划中）

#### 知识管理
- **资料管理**：支持文件夹分类、批量上传、Markdown 编辑
- **RAG 知识库**：集成 Dify 等 RAG 服务，基于自有知识库回答
- **文件处理**：支持 PDF、TXT、Markdown 等多种格式导入

#### 学习报告
- **日报生成**：每日自动总结学习内容和进度
- **周报/月报**：定期生成学习总结和成果回顾
- **数据分析**：学习时长、完成任务数等多维度统计

### 技术特性

- **多 Agent 协作**：Mentor、Advisor、Schedule、Plan、Lesson、Research 等多个专业 Agent
- **流式对话**：实时流式响应，提供流畅的对话体验
- **用户画像**：动态维护用户学习画像和上下文
- **本地优先**：SQLite + JSONL 存储，支持完全本地运行
- **定时任务**：学习提醒、进度检验、日报生成等自动化任务
- **数据加密**：敏感信息（如 API Key）加密存储
- **文件处理**：支持 PDF、TXT、Markdown 等多种格式导入

## 技术栈

- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript
- **UI**：Tailwind CSS + shadcn/ui
- **数据库**：Prisma + SQLite
- **认证**：NextAuth.js v5
- **AI**：Vercel AI SDK + OpenAI 兼容 API
- **测试**：Vitest + Testing Library
- **定时任务**：node-cron
- **文件处理**：pdf-parse, formidable
- **加密**：crypto (Node.js 内置)

## 快速开始

### 环境要求

- Node.js 18+ (推荐 20+)
- 一个兼容 OpenAI API 的 AI 服务（OpenAI、DeepSeek 等）

> **注意**：pnpm 会在启动脚本中自动安装，无需手动安装。

### 一键启动（推荐）

只需一条命令，自动完成克隆、依赖安装、数据库初始化、密钥生成与启动：

```bash
curl -fsSL https://raw.githubusercontent.com/LYD99/mentor-agent/main/install.sh | bash
```

> 如果还没装 Node.js 18+，请先安装：macOS 上 `brew install node`，或从 [nodejs.org](https://nodejs.org/) 下载。

脚本会自动完成：
- ✅ 克隆仓库到 `./mentor-agent`
- ✅ 检查 Node.js / 安装 pnpm
- ✅ 生成 `AUTH_SECRET` 与 `ENCRYPTION_KEY`
- ✅ 若 `AI_API_KEY` 无效/为空 → 自动打开 [DeepSeek 控制台](https://platform.deepseek.com/api_keys) 并引导输入与实时校验
- ✅ 若 `TAVILY_API_KEY` 为空 → 自动打开 [Tavily 控制台](https://app.tavily.com/home) 并引导输入（可跳过）
- ✅ 安装依赖、创建目录、初始化 SQLite 数据库
- ✅ 启动开发服务器并自动打开浏览器 `http://localhost:3000`

### 已克隆仓库？手动启动

```bash
git clone https://github.com/LYD99/mentor-agent.git
cd mentor-agent
./start.sh
```

`start.sh` 同样具备上述交互式引导与自动校验能力。

### 启动脚本选项

```bash
# 开发模式启动（默认）
./start.sh

# 构建后启动
./start.sh --build

# 生产模式启动
./start.sh --prod

# 跳过环境检查（不推荐）
./start.sh --skip-checks

# 查看帮助
./start.sh --help
```

### 手动安装（可选）

如果你更喜欢手动控制每一步：

1. 安装依赖

```bash
pnpm install
```

2. 初始化数据库

```bash
pnpm db:push
```

3. 启动开发服务器

```bash
pnpm dev
```

4. 访问应用

打开浏览器访问 http://localhost:3000，首次使用需要注册账号。

### 快速体验

启动成功后，浏览器会自动打开 http://localhost:3000

1. **注册账号**：首次使用需要创建账号
2. **配置 AI**：在设置页面配置 AI 模型和 API Key（如果 .env 中已配置则跳过）
3. **创建成长地图**：在成长页面创建学习计划
4. **开始学习**：与导师对话，获取学习建议
5. **查看进度**：在仪表盘查看学习进度和报告

> **提示**：如果 .env 文件配置不完整，启动脚本会提示你编辑配置。

## 项目结构

```
mentor-agent/
├── app/                    # Next.js App Router 页面和 API
│   ├── api/               # API 路由
│   │   ├── agent/        # Agent 相关 API (mentor, advisor)
│   │   ├── auth/         # 认证 API
│   │   ├── chat/         # 聊天会话 API
│   │   ├── config/       # 配置管理 API
│   │   ├── growth-map/   # 成长地图 API
│   │   ├── materials/    # 学习资料 API
│   │   ├── rag/          # RAG 知识库 API
│   │   ├── reports/      # 学习报告 API
│   │   └── ...
│   ├── advisor/          # 顾问页面
│   ├── bot/              # 外部机器人集成
│   ├── dashboard/        # 仪表盘
│   ├── growth/           # 成长地图页面
│   ├── materials/        # 学习资料管理
│   ├── mentor/           # 导师对话页面
│   ├── settings/         # 设置页面
│   └── ...
├── components/            # React 组件
│   ├── chat/             # 聊天相关组件
│   ├── growth-map/       # 成长地图组件
│   ├── materials/        # 学习资料组件
│   ├── settings/         # 设置组件
│   ├── ui/               # shadcn/ui 组件
│   └── ...
├── lib/                   # 核心库
│   ├── agents/           # Agent 实现
│   │   ├── tools/        # Agent 工具集
│   │   ├── lesson-agent.ts
│   │   ├── plan-agent.ts
│   │   ├── schedule-agent.ts
│   │   └── ...
│   ├── ai/               # AI 相关工具
│   ├── config/           # 配置服务
│   ├── jobs/             # 定时任务
│   ├── prompts/          # Prompt 模板
│   ├── services/         # 业务服务
│   │   ├── encryption-service.ts
│   │   ├── file-processor.ts
│   │   ├── rag-service.ts
│   │   └── ...
│   ├── storage/          # 存储层
│   └── ...
├── prisma/               # Prisma 数据库配置
│   ├── schema.prisma     # 数据库模型
│   └── data/             # SQLite 数据文件
├── data/                 # 本地数据存储
│   └── local/
│       └── sessions/     # JSONL 会话记录
├── scripts/              # 工具脚本
└── tests/                # 测试文件
```

## 开发指南

### 启动脚本命令

```bash
# 一键启动（推荐）
./start.sh            # 开发模式启动
./start.sh --build    # 构建后启动
./start.sh --prod     # 生产模式启动
./start.sh --help     # 查看帮助
```

### 可用命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产版本
pnpm start            # 启动生产服务器
pnpm lint             # 代码检查

# 测试
pnpm test             # 运行测试
pnpm test:ui          # 运行测试 UI

# 数据库
pnpm db:push          # 推送数据库变更
pnpm db:migrate       # 创建迁移
pnpm db:studio        # 打开 Prisma Studio
pnpm db:generate      # 生成 Prisma Client

# 工具
pnpm cleanup:jsonl    # 清理孤立的 JSONL 文件
```

> **提示**：首次启动或环境变更后，推荐使用 `./start.sh` 而不是直接运行 `pnpm dev`，以确保所有依赖和配置都正确。

### 添加新的 Agent

1. 在 `lib/agents/` 下创建新的 Agent 文件
2. 实现 Agent 的核心逻辑和工具（可在 `lib/agents/tools/` 下添加工具）
3. 在 `lib/prompts/` 下添加对应的 Prompt
4. 在 `app/api/agent/` 下创建 API 路由
5. 添加相应的测试

### 数据库变更

1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:push`（开发环境）或 `pnpm db:migrate`（生产环境）
3. 运行 `pnpm db:generate` 生成 Prisma Client
4. 更新相关的服务和 API

### 添加新的定时任务

1. 在 `lib/jobs/handlers/` 下创建任务处理器
2. 在 `lib/jobs/cron.ts` 中注册任务
3. 通过 API 或配置界面启用任务

## 配置说明

### AI 模型配置

支持任何兼容 OpenAI API 的模型：

- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- **DeepSeek**: deepseek-chat
- **其他兼容 OpenAI API 的模型**

可通过环境变量或设置界面配置：
- `AI_API_KEY`: API 密钥
- `AI_BASE_URL`: API 端点（支持代理）
- `AI_MODEL`: 模型名称

### 存储配置

- **数据库**：SQLite 文件存储在 `prisma/data/app.db`
- **会话记录**：JSONL 格式存储在 `data/local/sessions/`
- **学习材料**：存储在数据库中，支持 Markdown 格式
- **文件上传**：支持 PDF、TXT、Markdown 等格式

### RAG 知识库配置

集成 Dify 知识库服务：

1. 在 Dify 创建知识库并获取 API Key
2. 在设置页面添加知识库配置
3. 配置检索参数（top_k、score_threshold）
4. 启用后，AI 将自动检索相关知识

### 定时任务配置

使用 `node-cron` 实现本地定时任务：

- **学习提醒**：定时推送学习任务
- **进度检验**：定期检查学习进度
- **日报生成**：每日自动生成学习报告
- **周报/月报**：定期生成总结报告

可通过设置界面配置 cron 表达式和任务开关。

## 使用示例

### 创建学习计划

1. 访问"成长"页面
2. 点击"创建成长地图"
3. 描述学习目标（如"学习 TypeScript 从入门到精通"）
4. AI 将生成包含阶段、任务和时间表的完整学习计划
5. 审批并启动学习计划

### 与导师对话

```
用户: 我想学习 React Hooks，应该从哪里开始？

Mentor: 让我为你规划一个系统的学习路径...
1. 首先理解 useState 和 useEffect 的基础用法
2. 然后学习 useContext 和 useReducer 进行状态管理
3. 最后掌握自定义 Hooks 的编写

我可以为你生成每个阶段的详细课程，需要吗？
```

### 导入学习资料

1. 访问"资料"页面
2. 点击"批量上传"
3. 选择 PDF、Markdown 或 TXT 文件
4. AI 自动提取内容并分类存储
5. 在对话中可以引用这些资料

### 配置 RAG 知识库

1. 在 Dify 创建知识库并上传文档
2. 获取 API Key 和 Dataset ID
3. 在设置页面添加知识库配置
4. 启用后，AI 回答将基于你的知识库内容

## 测试

```bash
# 运行所有测试
pnpm test

# 运行测试 UI
pnpm test:ui

# 运行特定测试
pnpm test:message-stream

# 测试覆盖率
pnpm test --coverage
```

### 测试覆盖范围

- Agent 系统测试
- 存储层测试（JSONL、数据库）
- 加密服务测试
- RAG 服务测试
- 配置管理测试

## 架构设计

### Agent 系统

项目采用多 Agent 协作架构，每个 Agent 负责特定领域：

- **Mentor Agent**: 主导师，负责日常对话和学习指导
- **Advisor Agent**: 顾问，提供学习建议和规划咨询
- **Schedule Agent**: 调度器，生成学习计划和时间表
- **Plan Agent**: 规划师，创建成长地图和学习路径
- **Lesson Agent**: 讲师，生成每日课程和学习材料
- **Research Agent**: 研究员，进行网络搜索和资料收集

### 数据流

```
用户输入 → API 路由 → Agent 处理 → AI 模型 → 流式响应 → 前端展示
                ↓                ↓
            数据库存储      JSONL 记录
```

### 存储架构

- **结构化数据**: Prisma + SQLite（用户、配置、学习记录等）
- **会话数据**: JSONL 文件（完整对话历史，支持流式追加）
- **敏感数据**: AES-256-GCM 加密存储

## 部署

### 本地部署

#### 使用启动脚本（推荐）

```bash
# 生产模式启动（自动构建）
./start.sh --prod
```

#### 手动部署

1. 构建生产版本：`pnpm build`
2. 启动服务：`pnpm start`
3. 访问 http://localhost:3000

### Docker 部署

```bash
# 构建镜像
docker build -t mentor-agent .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DATABASE_URL=file:/app/data/app.db \
  -e AUTH_SECRET=your-secret \
  -e AI_API_KEY=your-key \
  -e ENCRYPTION_KEY=your-encryption-key \
  mentor-agent
```

> **注意**：本地开发推荐使用 `./start.sh`，Docker 适合生产环境部署。

### 云端部署

项目支持部署到 Vercel、Railway、Fly.io 等平台。注意事项：

- 确保持久化存储（数据库和 JSONL 文件）
- 配置环境变量
- 定时任务在 Serverless 环境可能需要额外配置

## 常见问题

### 如何启动项目？

最简单的方式是运行一键启动脚本：

```bash
./start.sh
```

脚本会自动检查环境、安装依赖、初始化数据库并启动应用。首次运行时，如果 `.env` 配置不完整，脚本会提示你编辑配置。

### 启动脚本做了什么？

启动脚本会按顺序执行以下操作：

1. 检查 Node.js 版本（需要 18+）
2. 检查并安装 pnpm（如果未安装）
3. 验证 `.env` 配置文件
4. 安装项目依赖（如果需要）
5. 创建必要的目录（data/local/sessions, prisma/data）
6. 生成 Prisma Client
7. 初始化或同步数据库
8. 清理孤立的 session 文件
9. 启动开发服务器
10. 自动打开浏览器

### 如何切换 AI 模型？

在设置页面修改 AI 配置，或直接修改 `.env` 文件中的 `AI_MODEL` 和 `AI_BASE_URL`。

### 数据存储在哪里？

- 数据库：`prisma/data/app.db`
- 会话记录：`data/local/sessions/`
- 所有数据完全本地存储，不会上传到云端

### 如何备份数据？

备份以下文件/目录即可：
- `prisma/data/app.db`（数据库）
- `data/local/sessions/`（会话记录）

### 支持哪些 AI 模型？

支持所有兼容 OpenAI API 的模型，包括但不限于：
- OpenAI 官方模型
- DeepSeek
- 国内大模型（通义千问、文心一言等，需要 API 代理）
- 本地部署的模型（如 Ollama）

### 如何集成外部知识库？

1. 在 Dify 或其他 RAG 服务创建知识库
2. 在设置页面添加知识库配置
3. 配置 API Key 和检索参数
4. 启用后，AI 将自动检索相关知识

### 性能优化建议

- **数据库**：定期清理旧的会话记录和日志
- **JSONL 文件**：使用 `pnpm cleanup:jsonl` 清理孤立文件
- **AI 模型**：根据场景选择合适的模型（简单任务用 mini 模型）
- **缓存**：启用浏览器缓存，减少重复请求

### 安全性说明

- **API Key 加密**：使用 AES-256-GCM 加密存储
- **密码哈希**：使用 bcrypt 哈希用户密码
- **会话管理**：使用 NextAuth.js 管理用户会话
- **环境变量**：敏感信息通过环境变量配置，不提交到代码库
- **数据隔离**：多用户数据完全隔离，互不干扰

### 故障排除

**问题：启动脚本执行失败**
- 确保脚本有执行权限：`chmod +x start.sh`
- 检查 Node.js 版本是否 >= 18：`node -v`
- 查看脚本输出的错误信息，按提示修复

**问题：环境变量配置错误**
- 启动脚本会自动检查必填配置项
- 如果提示配置错误，编辑 `.env` 文件并重新运行
- 生成 AUTH_SECRET：`openssl rand -base64 32`
- 生成 ENCRYPTION_KEY：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**问题：数据库连接失败**
- 检查 `DATABASE_URL` 配置是否正确
- 确保 `prisma/data/` 目录存在且有写权限
- 运行 `./start.sh` 会自动初始化数据库
- 手动初始化：`pnpm db:push`

**问题：AI 响应失败**
- 检查 `AI_API_KEY` 是否正确
- 检查 `AI_BASE_URL` 是否可访问
- 查看浏览器控制台和服务器日志
- 测试 API 连接：`curl -H "Authorization: Bearer $AI_API_KEY" $AI_BASE_URL/models`

**问题：定时任务不执行**
- 检查 cron 表达式是否正确
- 确保任务状态为"启用"
- 查看 `instrumentation.ts` 是否正确注册

**问题：端口 3000 被占用**
- 修改 `.env` 中的 `PORT` 环境变量
- 或者停止占用 3000 端口的进程：`lsof -ti:3000 | xargs kill`

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 添加必要的注释和类型定义
- 为新功能添加测试

### 开发最佳实践

#### Agent 开发
- 每个 Agent 应该有明确的职责和边界
- 使用工具（tools）封装可复用的功能
- Prompt 应该清晰、具体，包含必要的上下文
- 处理流式响应时注意错误处理和状态管理

#### 数据存储
- 结构化数据使用 Prisma + SQLite
- 会话历史使用 JSONL 格式，支持流式追加
- 敏感信息必须加密存储
- 定期清理过期数据，避免数据库膨胀

#### 性能优化
- 使用流式响应提升用户体验
- 合理使用数据库索引
- 避免在循环中进行数据库查询
- 大文件处理使用流式读取

#### 安全考虑
- 所有用户输入必须验证和清理
- API 路由需要认证和权限检查
- 敏感操作需要二次确认
- 定期更新依赖包，修复安全漏洞

## 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 集成工具
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Dify](https://dify.ai/) - RAG 知识库服务

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 提交 Issue: [GitHub Issues](https://github.com/LYD99/mentor-agent/issues)
- 功能建议: [GitHub Discussions](https://github.com/LYD99/mentor-agent/discussions)
- Pull Request: 欢迎贡献代码

---

**项目特点**：
- ✅ 一键启动，自动完成所有配置和初始化
- ✅ 完全本地运行，数据隐私有保障
- ✅ 支持多种 AI 模型，灵活配置
- ✅ 多 Agent 协作，专业分工
- ✅ 开源免费，可自由定制

**适用场景**：
- 个人学习规划和知识管理
- 在线教育和辅导
- 企业培训和知识库
- AI Agent 系统研究和开发
