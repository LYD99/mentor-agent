# Mentor Agent

一个基于 AI 的智能导师系统，提供个性化学习规划、知识讲解、练习批改和学习进度跟踪。

## 功能特性

### 核心功能

- **智能导师对话**：与 AI 导师进行自然对话，获取学习建议和指导
- **个性化学习规划**：基于用户背景和目标生成定制化学习路径
- **知识讲义生成**：自动生成结构化的学习材料
- **练习与批改**：智能生成练习题并提供详细批改反馈
- **学习进度跟踪**：可视化展示学习进度和成长地图
- **错题本管理**：记录和复习错题，针对性提升

### 技术特性

- **多 Agent 协作**：Mentor、Advisor、Research、Plan、Knowledge、Exercise 等多个专业 Agent
- **流式对话**：实时流式响应，提供流畅的对话体验
- **用户画像**：动态维护用户学习画像和上下文
- **本地优先**：SQLite + JSONL 存储，支持完全本地运行
- **定时任务**：学习提醒、进度检验、日报生成等自动化任务

## 技术栈

- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript
- **UI**：Tailwind CSS + shadcn/ui
- **数据库**：Prisma + SQLite
- **认证**：NextAuth.js v5
- **AI**：Vercel AI SDK
- **测试**：Vitest + Testing Library

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/yourusername/mentor-agent.git
cd mentor-agent
```

2. 安装依赖

```bash
pnpm install
```

3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

必填配置项：

```env
# 数据库
DATABASE_URL=file:./prisma/data/app.db

# 认证（使用 openssl rand -base64 32 生成）
AUTH_SECRET=your-secret-here
AUTH_URL=http://localhost:3000

# AI 配置
AI_API_KEY=your-api-key-here
AI_BASE_URL=https://api.openai.com
AI_MODEL=gpt-4o-mini
```

4. 初始化数据库

```bash
pnpm db:push
```

5. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 项目结构

```
mentor-agent/
├── app/                    # Next.js App Router 页面和 API
│   ├── api/               # API 路由
│   │   ├── agent/        # Agent 相关 API
│   │   ├── auth/         # 认证 API
│   │   └── ...
│   ├── materials/        # 学习材料页面
│   └── ...
├── components/            # React 组件
│   ├── chat/             # 聊天相关组件
│   ├── ui/               # shadcn/ui 组件
│   └── ...
├── lib/                   # 核心库
│   ├── agents/           # Agent 实现
│   ├── prompts/          # Prompt 模板
│   ├── services/         # 业务服务
│   └── ...
├── prisma/               # Prisma 数据库配置
│   ├── schema.prisma     # 数据库模型
│   └── data/             # SQLite 数据文件
├── scripts/              # 工具脚本
└── tests/                # 测试文件
```

## 开发指南

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

### 添加新的 Agent

1. 在 `lib/agents/` 下创建新的 Agent 文件
2. 实现 Agent 的核心逻辑和工具
3. 在 `lib/prompts/` 下添加对应的 Prompt
4. 在 `app/api/agent/` 下创建 API 路由
5. 添加相应的测试

### 数据库变更

1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:push` 或 `pnpm db:migrate`
3. 更新相关的服务和 API

## 配置说明

### AI 模型配置

支持任何兼容 OpenAI API 的模型：

- OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- DeepSeek: deepseek-chat
- 其他兼容 OpenAI API 的模型

### 存储配置

- **数据库**：SQLite 文件存储在 `prisma/data/app.db`
- **会话记录**：JSONL 格式存储在 `data/local/sessions/`
- **学习材料**：存储在数据库中，支持 Markdown 格式

### 定时任务配置

使用 `node-cron` 实现本地定时任务：

- 学习提醒
- 进度检验
- 日报生成
- 讲义更新提醒

## 测试

```bash
# 运行所有测试
pnpm test

# 运行测试 UI
pnpm test:ui

# 运行特定测试
pnpm test:message-stream
```

## 部署

### 本地部署

1. 构建生产版本：`pnpm build`
2. 启动服务：`pnpm start`

### 云端部署（可选）

项目支持部署到 Vercel、Docker 等平台。详细部署文档请参考 `docs/` 目录。

## 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 致谢

- [Next.js](https://nextjs.org/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Prisma](https://www.prisma.io/)
- [shadcn/ui](https://ui.shadcn.com/)

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

**注意**：本项目目前为本地优先设计，适合个人学习和开发使用。云端部署功能正在开发中。
