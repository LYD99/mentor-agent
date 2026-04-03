# Mentor Agent 实现计划（完整功能 · 本地优先）

> 依据：`mentor-agent/td.md`。  
> **范围**：按技术方案实现 **完整功能闭环**（非 MVP 砍需求清单）。  
> **运行环境**：**仅考虑本地** — `pnpm dev` + 本机 SQLite + 本机目录下的 JSONL；**暂不纳入** 云端部署、Vercel/容器生产发布（后续单开一章即可）。  
> **LLM 会话存储**：**OpenCode 风格 SQLite**（会话索引、元数据、列表与关联）+ **Kimi CLI 风格 JSONL**（**逐行追加、保留完整对话内容**含 tool/多段输出）。

---

## 1. 功能目标（与 `td.md` 对齐的验收清单）

### 1.1 用户、上下文与画像

| 能力 | 验收标准 |
|------|----------|
| 注册登录 | Credentials（本地）；预留 OAuth 配置位但不作为本期交付 |
| User Context Pack | CRUD；Agent 调用前稳定拼装环境块；支持 pinned / 过期字段 |
| 动态画像 | `profile_update_proposals` + 确认/驳回 UI；`profile_change_history` 审计；低风险字段可自动合并策略可配置 |

### 1.2 多 Agent 与主链路

| 能力 | 验收标准 |
|------|----------|
| Mentor | 流式对话；协调 Research/Plan；注入 Context Pack；**会话 SQLite + JSONL 双写** |
| Advisor | 讲义/任务锚点 + 节选注入；流式；可选 Research 工具调用；**独立 channel 与 JSONL 文件** |
| Research | `SearchProvider`（Tavily/Serper/Perplexity 等可切换）；结果入 `research_results` |
| Plan | 生成成长地图 JSON → 写入 stages/goals/tasks；用户 PATCH 调图 |
| **地图进度与学情** | 成长地图 **可视化进度**（阶段/目标/任务完成度、进行中、未开始）；**学习状态**（当前聚焦任务、最近学习日、连续打卡、讲义阅读/测验状态）；支持从地图 **下钻** 到任务详情与历史 |
| **地图 + 环节学习数据 + Agent Tool** | 存储除 **拓扑（地图树）** 外，各 **环节**（阶段/目标/任务）上的 **过程与结果数据**（见 §4.1）；Mentor / Advisor / Plan（及按需 Knowledge、Exercise）通过 **统一 Tool 接口** 拉取学情，用于诊断卡点、调整计划与讲解深度；Tool 实现与 `GET /plan/.../progress` **共用查询层**，避免重复逻辑 |
| Knowledge / 讲义 | 地图确认后生成/修订 `learning_lessons`（Markdown、sources_json、版本链） |
| Exercise | 题目生成、提交、批改点评、错题本；错题一键拉起 Advisor |

### 1.3 学习任务与本地「推送」

| 能力 | 验收标准 |
|------|----------|
| 定时任务 | `scheduled_tasks` 完整类型（学习提醒、检验、日报、讲义提醒）；**本地**用 `node-cron`（或 BullMQ+Redis 可选）驱动 |
| 本地通知 | 浏览器内通知中心 / 页面角标 / 可选 `node-notifier`（本机系统通知）；**不做** 云端 IM 推送为必达项 |

### 1.4 其它模块（按 `td.md`）

| 能力 | 验收标准 |
|------|----------|
| 日报与报告 | 日报、AI 摘要；周/月报告（可先图表简化版） |
| 社区与互助 | 可二期；若纳入则 API + 最简 UI |
| 数据合规 | 导出/删除含 Context、讲义元数据、**JSONL 文件**、SQLite 会话索引 |
| 商业化 | 限流与计费策略接口预留；本地可关闭 |

### 1.5 本期明确不包含

- **任何云端部署**（CI/CD、Vercel、K8s、生产环境变量矩阵）— 文档可留一页占位即可  
- **Neo4j / 生产 S3**（可选：本地磁盘存 PDF/大附件）  
- **多端 IM Bot**（微信/钉钉等）— 接口预留即可  

---

## 2. 技术栈（锁定 · 本地）

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | **Next.js 14**（App Router） | API Route 即后端，本地 `localhost` |
| 语言 | **TypeScript** | strict |
| UI | **Tailwind + shadcn/ui** | |
| 鉴权 | **Auth.js / NextAuth v5** | Credentials；本地 `AUTH_SECRET` |
| 业务库 | **Prisma + SQLite** | `DATABASE_URL=file:./data/app.db`（路径统一放 `data/`） |
| 会话全文 | **JSONL 文件** | 见 §3，与 Kimi CLI 一致「一行一条完整消息 JSON」 |
| 队列（可选） | **BullMQ + 本机 Redis** 或 **内存队列 + cron** | 完整功能建议上 Redis；仅本地亦可 Docker 起一个 redis |
| AI | **Vercel AI SDK (`ai`)** + 兼容 OpenAI 的 provider | 流式 + tool call |
| 搜索 | **Tavily / Serper 等** | 真实 key 本地 `.env` |
| Agent Tool | **Vercel AI SDK `tool()`** | 学情类 Tool 调 Prisma 只读服务；**不写**由 Tool 直接改库（写仍走业务 API / 事件入库） |

**`.env.example`（本地）**

```env
DATABASE_URL="file:./data/app.db"
LOCAL_DATA_DIR="./data/local"          # JSONL、导出缓存根目录
AUTH_SECRET=""
AI_API_KEY=""
AI_BASE_URL=""
NEXTAUTH_URL="http://localhost:3000"
TAVILY_API_KEY=""
# SERPER_API_KEY=""
```

**目录约定（建议）**

```text
data/
├── app.db                 # Prisma SQLite
└── local/
    └── sessions/          # JSONL：每会话一个文件
        ├── {sessionId}.jsonl
        └── ...
```

`.gitignore`：`data/` 或至少 `data/**/*.db`、`data/local/sessions/*.jsonl`（若需提交空目录可用 `.gitkeep`）。

---

## 3. LLM 消息存储：OpenCode 式 SQLite + Kimi CLI 式 JSONL

### 3.1 设计原则

| 存储 | 职责 | 类比 |
|------|------|------|
| **SQLite（Prisma）** | 会话列表、与用户/地图/讲义/任务外键、时间序索引、列表页展示字段、**JSONL 文件路径**、可选摘要字段 | OpenCode：`session` + `message`（元数据/结构化索引）；本方案 **正文大字段不进 SQLite** |
| **JSONL** | **完整对话内容**：每条消息一行 JSON，**追加写**、便于人工 `tail`、备份、外部工具（含 Kimi CLI）消费 | Kimi CLI 会话 jsonl：保留 role、多段 content、tool_calls、usage 等 **无损** 信息 |

### 3.2 JSONL 行格式（建议 Schema）

每行一个 JSON 对象（**ndjson**），例如：

```json
{
  "id": "msg_xxx",
  "session_id": "sess_xxx",
  "seq": 42,
  "role": "user",
  "created_at": "2026-03-31T12:00:00.000Z",
  "channel": "mentor",
  "payload": {
    "parts": [{ "type": "text", "text": "..." }],
    "raw_request": {},
    "raw_response": {}
  },
  "usage": { "prompt_tokens": 0, "completion_tokens": 0 },
  "model": "kimi-xxx"
}
```

- **assistant** 行可含 `tool_calls`、`reasoning`（若模型提供）、**流式合并后的最终全文**。  
- **不截断**：流式结束后一次性写入完整 assistant 行（与 Kimi CLI 保留完整 trace 一致）。  
- 若需调试流式过程，可额外写 `*.jsonl.debug` 或 `parts` 内数组记录 delta（可选）。

### 3.3 SQLite 表（会话索引，对齐 OpenCode 思路）

**`ChatSession`（会话）**

- `id`, `user_id`, `channel`（`mentor` | `advisor` | 预留 `system`）  
- `title`, `growth_map_id?`, `lesson_id?`, `task_id?`  
- `jsonl_path`（相对 `LOCAL_DATA_DIR` 的路径，如 `sessions/sess_xxx.jsonl`）  
- `message_count`, `last_message_at`  
- `created_at`, `updated_at`  

**`ChatMessageIndex`（消息索引，不存全文）**

- `id`, `session_id`, `seq`（会话内单调递增）  
- `role`, `created_at`  
- `jsonl_line`（**从 1 开始的行号**，便于 `readline` 跳转）或 `byte_offset`（高级）  
- `preview`（可选，前 200 字供列表）  
- `hash`（可选，SHA256 of line content 做完整性校验）  

> 与 OpenCode 差异：OpenCode 的 `message`/`part` 用 JSON 存在 SQLite；本方案 **全文仅在 JSONL**，SQLite 只做 **索引 + 关联**，避免 DB 膨胀且与 Kimi 工具链互通。

### 3.4 双写调用顺序（每条消息必须一致）

在 `onFinish` / 流式结束回调中：

1. **追加**一行到 `{LOCAL_DATA_DIR}/{jsonl_path}`（`fs.appendFile` + `\n`，注意并发同会话串行锁：`AsyncMutex` 或 Node 单线程队列 per `sessionId`）。  
2. **计算**行号（当前文件行数 或 维护内存计数器 + flush 后校验）。  
3. **插入** `ChatMessageIndex` + 更新 `ChatSession.message_count`、`last_message_at`。  
4. 若 1 成功 2 失败：记录 **orphan 行** 告警任务，提供 CLI `repair-index` 从 JSONL 重建索引（完整功能必备运维能力）。

### 3.5 读取与上下文组装

- **列表页**：只查 SQLite。  
- **续聊上下文**：优先从 JSONL **按 seq 或最近 N 行** 读入组装 messages（或最近 N token 预算）；大会话可「SQLite 摘要 + 仅末 K 条全文」。  
- **导出**：直接复制 `.jsonl` + `sqlite` 即可完整备份。

### 3.6 实现模块路径

```text
src/lib/storage/
├── session-store.ts       # 创建会话、解析 jsonl_path
├── jsonl-append.ts        # 追加行、行锁、行号
├── jsonl-read.ts          # 按行号/范围读取
├── chat-dual-write.ts     # 对外：appendMessage({ sessionId, role, payload })
└── repair-index.ts        # 从 JSONL 重建 ChatMessageIndex
```

---

## 4. 项目架构（仓库目录）

```text
mentor-agent/
├── plan.md
├── td.md
├── package.json
├── data/                    # gitignore，见 §2
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/...
│   │   ├── (dashboard)/...
│   │   ├── api/
│   │   │   ├── agent/mentor/route.ts
│   │   │   ├── agent/advisor/route.ts
│   │   │   ├── agent/research/route.ts
│   │   │   ├── growth/request/route.ts
│   │   │   ├── plan/[id]/route.ts
│   │   │   ├── plan/[id]/progress/route.ts   # 可选：聚合进度 JSON，供地图页与仪表盘
│   │   │   ├── plan/[id]/confirm/route.ts
│   │   │   ├── lessons/...
│   │   │   ├── exercise/...
│   │   │   ├── report/route.ts
│   │   │   ├── user/context/route.ts
│   │   │   ├── user/profile/proposals/route.ts
│   │   │   └── sessions/...            # 列表、导出、删除
│   │   └── ...
│   ├── components/
│   └── lib/
│       ├── auth.ts
│       ├── db.ts
│       ├── storage/                   # §3.6
│       ├── ai/...
│       ├── agents/
│       │   ├── learning-query.ts      # §4.1
│       │   └── tools/
│       │       └── learning-data.ts
│       ├── jobs/cron.ts
│       └── validators/
└── scripts/
    └── repair-chat-index.ts           # 可选：pnpm repair:index
```

### 4.1 成长地图与学习数据存储（拓扑 + 环节数据 + Agent Tools）

**存储分层**

| 层级 | 内容 | 用途 |
|------|------|------|
| **地图拓扑** | `growth_maps` + `growth_stages` / `growth_goals` / `growth_tasks` | 规划结构、与用户确认的「应学路径」 |
| **环节状态与汇总** | `task_progress`、`task_learning_state`（或与 progress 合并宽表） | 每任务当前进度、最近活跃、讲义/测验摘要字段 |
| **学习事件流（推荐）** | `learning_events` 追加表 | 细粒度行为：`lesson_open`、`lesson_progress`、`exercise_submit`、`advisor_session_summary`、`daily_report_linked`、`task_status_change` 等，`payload_json` 存结构化细节；供 Tool **按需过滤查询** 与时间线回放 |
| **可选聚合缓存** | `map_learning_rollups` 或 `user_map_snapshot`（JSON） | 定时任务汇总地图级/阶段级指标，降低高频 Tool 扫表成本 |

**原则**：Agent 需要「用户在各环节 **实际怎样学**」时，优先 **Tool 查库**（新鲜、可引用 task/stage id），而不是仅靠 System Prompt 里塞静态 Context Pack；Context Pack 与 **学情 Tool 结果** 在 `buildAgentContext` 中合并注入（控制 token：Tool 返回摘要 + 可分页）。

**Agent Tool 清单（示例，名称以最终实现为准）**

| Tool | 入参 | 返回要点 | 典型调用方 |
|------|------|----------|------------|
| `get_growth_map_progress` | `map_id` | 树 + 每节点 `status` / `percent` / `last_activity_at` | Mentor、Plan |
| `get_task_learning_detail` | `task_id` | `task_progress`、关联 `learning_lessons` 摘要、最近 `learning_events`、Exercise/日报链接摘要 | Advisor、Mentor |
| `get_stage_learning_summary` | `stage_id` | 该阶段任务完成率、受阻任务列表、近期事件摘要 | Plan、Mentor |
| `list_recent_learning_events` | `map_id?`, `task_id?`, `types[]?`, `limit` | 时间倒序事件列表（截断 + 总条数 hint） | 全 Agent |

**实现位置**

```text
src/lib/agents/
├── learning-query.ts          # 纯函数/SQL：progress 聚合、事件查询（供 HTTP 与 Tool 共用）
└── tools/
    └── learning-data.ts       # tool() 定义 + execute 内调 learning-query + 鉴权 userId
```

**写路径（与 §6.4.1 一致并扩展）**：业务动作（完成任务、交卷、打开讲义、提交日报等）在更新 `task_progress` 的同时 **追加一条 `learning_events`**，保证 Tool 与仪表盘数据源一致。

---

## 5. 代码架构（依赖关系）

```mermaid
flowchart TB
  subgraph HTTP[API Routes]
    M[/api/agent/mentor]
    A[/api/agent/advisor]
    G[/api/growth/request]
    C[/api/plan/id/confirm]
  end
  subgraph Core[lib/agents + lib/ai]
    CP[context-pack]
    DW[chat-dual-write]
    LQ[learning-query + tools]
    RA[research]
    PA[plan-agent]
    LG[lesson-generator]
  end
  subgraph SQLite[(Prisma SQLite)]
  end
  subgraph Files[(JSONL files)]
  end
  M --> CP
  M --> DW
  M --> LQ
  A --> CP
  A --> DW
  A --> LQ
  G --> CP
  G --> RA
  G --> PA
  PA --> LQ
  C --> LG
  DW --> SQLite
  DW --> Files
  LQ --> SQLite
  CP --> SQLite
  RA --> SQLite
  PA --> SQLite
  LG --> SQLite
```

---

## 6. 调用链路（关键路径 + 存储触点）

### 6.1 Mentor 对话

1. `POST /api/agent/mentor` → 鉴权 → `buildContextPack` → `loadSession` / 创建 `ChatSession` + 空 jsonl  
2. 从 JSONL（+ 可选摘要）组装 `messages` 给模型  
3. `streamText`（或 `streamText` + **tools**：`...learningDataTools({ userId })`）→ 模型可通过 **学情 Tool** 拉取当前地图/任务/阶段数据后再组织回答；**Tool execute** 仅只读 Prisma，返回 JSON 摘要（控制长度）  
4. **结束后** `chatDualWrite.appendAssistantTurn(...)`（含完整合并文本、usage、model；若含 tool 调用，写入 JSONL `payload.tool_calls` / 结果摘要）  
5. 用户每条 user 消息在请求入口即 `appendUserTurn`（先于模型调用，便于崩溃也有用户侧记录）

### 6.2 Advisor

1. `POST /api/agent/advisor` → 带 `lesson_id`/`task_id` → 加载讲义节选  
2. **channel=`advisor`** 独立 `ChatSession`；JSONL 路径独立文件  
3. 双写规则同 6.1；工具除 **Research** 外，挂载 **`get_task_learning_detail` / `list_recent_learning_events`**（限定当前 `map_id`/`task_id` 范围），便于结合「本题历史」讲解  
4. Tool 结果写入 JSONL `payload`（与 Research 一致）  

### 6.3 成长诉求 → Research → Plan

1. `POST /api/growth/request` → `growth_requests` + Research → `research_results`  
2. Plan → 可挂载 **`get_growth_map_progress` / `get_stage_learning_summary`**（当用户基于 **已有地图** 做「调整/加任务」时，先拉当前学情再生成 diff）→ 事务写入地图树  
3. 本链路 **不产生 LLM JSONL**（可选：将「规划请求」记一条 `system` 会话便于审计）

### 6.4 地图确认 → 讲义 + 定时任务

1. `POST /api/plan/:id/confirm`  
2. 讲义生成 job → `learning_lessons`  
3. `scheduled_tasks` + 本地 cron 注册（进程内或独立 worker 进程读同一 SQLite）

### 6.4.1 地图进度与学情（读路径）

1. `GET /api/plan/:id`（或扩展字段）返回地图树时，**附带**各 `task_id` 的进度摘要（来自 `task_progress` + 可选讲义/测验派生状态）；或  
2. `GET /api/plan/:id/progress` 返回聚合结构：`map` 级总进度（0～100%）、`stage[]` / `goal[]` / `task[]` 的 `status`（`not_started` | `in_progress` | `done` | `blocked`）、`updated_at`、`streak_days`、`last_study_at` 等（具体字段见 §7.1）  
3. 前端 `/plan/[id]`：树或时间轴 + **进度条/色块**；点击任务打开抽屉：任务状态、关联讲义阅读标记、Exercise 结果、最近日报摘录（按需查询，避免单次 payload 过大）  
4. **写路径**：用户「标记完成/开始」、`PATCH /api/task/:id`、讲义页停留/滚动上报（可选）、Exercise 提交成功、日报关联任务等事件 → 更新 `task_progress` / `task_learning_state`，并 **追加 `learning_events`**（见 §4.1），地图页与 Agent Tool 下次读取一致  

### 6.5 画像提案

1. 异步任务分析 Mentor/Advisor JSONL 或 SQLite 摘要 → `profile_update_proposals`  
2. 用户 `POST .../accept` → 更新 `user_profiles` + `profile_change_history`

---

## 7. 数据库落地顺序（Prisma）

建议迁移顺序（可合并为少量 migration）：

1. Auth 用户表 + `UserProfile` + `UserContextItem`  
2. `ChatSession` + `ChatMessageIndex`（与 §3 一致）  
3. `GrowthRequest` / `ResearchResult` / `GrowthMap` / Stage / Goal / Task  
4. `LearningLesson` / `TaskProgress` / `ScheduledTask`  
5. **进度、环节学情与事件（与地图联动 + Agent Tool）**  
   - `task_progress`：`user_id`, `task_id`, `status`, `started_at`, `completed_at`, `notes`；可扩展 `percent`, `last_activity_at`  
   - **可选** `task_learning_state`（或宽表合并）：`lesson_read_percent`, `last_opened_lesson_at`, `quiz_passed`, `exercise_summary_json`  
   - **`learning_events`**（推荐）：`id`, `user_id`, `map_id?`, `stage_id?`, `goal_id?`, `task_id?`, `type`, `payload_json`, `created_at`；索引 `(user_id, task_id, created_at)`、`(user_id, map_id, created_at)` 供 Tool 扫描  
   - **可选** `map_learning_rollups`：`map_id`, `user_id`, `summary_json`, `updated_at`（定时刷新）  
   - `GET .../progress` 与 **学情 Tool** 共用 `lib/agents/learning-query.ts`  
6. `DailyReport`（可与 `task_id`/`map_id` 关联；提交时写一条 `learning_events`）  
7. `ProfileUpdateProposal` / `ProfileChangeHistory`  
8. Exercise 相关表（题目、提交、错题）  
9. `UserContextPackCache`（可选）

---

## 8. 前端（完整功能页面矩阵）

| 路由 | 作用 |
|------|------|
| `/` | 仪表盘：今日任务、提醒、快捷入口；**当前地图进度摘要**（与 `/plan/[id]/progress` 同源数据可复用） |
| `/onboarding` | Context Pack |
| `/mentor` | Mentor 聊天（流式）；会话列表读 SQLite |
| `/growth/new` | 诉求提交 + 地图预览 |
| `/plan/[id]` | 树形编辑、确认、讲义状态；**进度总览**（地图/阶段/任务完成率、状态色、最近学习信息）；任务下钻抽屉 |
| `/learn/[lessonId]` | Markdown + 问顾问侧栏 |
| `/exercise/...` | 练习与错题 |
| `/report` | 日报与历史 |
| `/settings/profile` | 画像与提案确认 |
| `/settings/data` | **导出 JSONL / 导出 DB / 清除本地数据** |

---

## 9. AI Coding 时间规划（完整功能 · 建议节奏）

完整功能 **显著大于 3 人日**；下表按 **约 2～3 周（单人 + AI 辅助）** 排期，可按人力并行压缩。

### Week 1：地基 + 会话双写 + 双 Agent

| 天 | 产出 |
|----|------|
| 1 | Next.js + Prisma + SQLite；`LOCAL_DATA_DIR`；`ChatSession` / `ChatMessageIndex`；**jsonl-append + 双写 + 单测** |
| 2 | Auth；Context Pack API；`chat-dual-write` 与 Mentor 流式对接；**repair-index 脚本雏形** |
| 3 | Mentor UI + 会话列表；Advisor API + 节选注入 + 独立 JSONL |
| 4 | Research `SearchProvider` + 真实 API；`growth/request` 串起来 |
| 5 | PlanAgent + Zod 校验 + 写入地图；`/growth` + `/plan` 只读/编辑；**`task_progress` + `learning_events` 写入**；**地图页 progress API**；**学情 Tool + `learning-query` 共用层** |

### Week 2：讲义、定时、Exercise、画像

| 天 | 产出 |
|----|------|
| 6～7 | 地图确认 → 讲义生成（Markdown + sources）；版本字段 |
| 8 | `scheduled_tasks` + 本地 cron + 应用内通知 |
| 9 | Exercise + 错题 → Advisor 跳转 |
| 10 | 日报 + 周报表；`profile_update_proposals` + UI |

### Week 3：合规、运维、打磨

| 天 | 产出 |
|----|------|
| 11～12 | 数据导出/删除（含 JSONL）；错误处理；限流占位 |
| 13～14 | E2E 关键路径（可选）；README 本地一键文档；性能（大 JSONL  tail 读取优化） |

### 附录：若必须压缩为「3 天演示子集」

仅作 **演示** 而非完整功能：保留 **双写协议** + Mentor + 单条成长链 Mock；Advisor/讲义/提案可延后。**不建议**在 3 天内宣称「完整功能」。

---

## 10. AI 编码使用方式

1. **先实现 `lib/storage/jsonl-append.ts` + `chat-dual-write.ts` 并通过单测**，再挂 Mentor/Advisor Route。  
2. **先实现 `learning-query.ts`（progress 聚合 + events 查询）**，再挂 `GET /progress` 与 **学情 Tool**，避免两套 SQL。  
3. **所有会话 ID 用 uuid**；文件名与 `ChatSession.id` 一致，避免碰撞。  
4. Prompt 与存储解耦：`payload.raw_*` 可配置是否写入（隐私与体积）。  
5. Tool 返回体做 **硬限制**（最大条数、最大字符），防止撑爆上下文。  
6. 大模型 JSON（Plan）先 Zod，再落库。  

---

## 11. 风险与缓解

| 风险 | 缓解 |
|------|------|
| JSONL 与 SQLite 不一致 | 双写顺序 + `repair-index`；定期校验 `hash` |
| 单文件过大 | 按会话分文件（已采纳）；超大会话按周 rotate（可选） |
| 并发追加 | 每 `sessionId` 内存队列串行化 append |
| 本地路径权限 | 文档写明 `LOCAL_DATA_DIR` 必须在应用可写盘 |
| 学情 Tool 越权 | **execute 内强制 `userId` 来自 session**，所有查询带 `user_id` 条件；禁止 Tool 根据模型传入 `userId` 跨用户读 |
| Tool 结果被模型误读 | 返回 Schema 固定、关键字段人类可读短句 + `ids` 供二次查询 |

---

## 12. 与 `td.md` 的差异（后续再做）

- 云端部署与多环境配置  
- 对象存储大规模附件、Neo4j  
- IM Bot、多租户 SaaS 计费  

---

**文档版本**：与 `td.md` 同步；存储方案变更须同时更新本文 §3 与 Prisma schema 说明。
