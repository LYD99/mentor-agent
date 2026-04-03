# 技术方案（Technical Design）

## 1. 总体架构
- 前端：React + TypeScript 单页应用，支持多端适配，与后端API通信。
- 后端：Node.js（Express/Vite/Next.js等）RESTful API，负责业务逻辑、用户管理、任务调度、AI对接。
- AI服务：对接主流大模型API（如OpenAI、DeepSeek、Claude等），支持多Agent能力。
- **学习交付**：除推送学习计划与提醒外，为每个学习任务生成可阅读的 **学习文档/讲义**（家教式全套：计划 + 材料 + 检验 + 复盘），正文存库或对象存储，前端在线阅读，可选导出 PDF。
- **即时答疑**：学习过程中由 **顾问 Agent（Advisor）** 提供「不会就问」的解答（概念、步骤、报错/错题），与 **Mentor** 分工协作（见 2.2）。
- 数据库：默认内置 SQLite/JSON 文件存储，支持零配置本地开发，生产环境可切换为云数据库（如PostgreSQL）。
- 消息/任务：基于Node定时任务或轻量消息队列实现定时任务、消息推送。
- Bot集成：Webhook/SDK对接主流IM（如微信、钉钉、Telegram等）。

## 2. 核心模块设计

### 2.1 用户与权限
- 用户注册/登录（支持邮箱、手机号、第三方OAuth）
- 用户画像（角色、成长阶段、兴趣标签、学习风格与行为特征等，见下节）
- 权限分级（普通用户、导师、管理员）

#### 用户环境上下文与动态画像（User Context Pack）
- **用户环境上下文（User Context Pack）**：单独存储、结构化维护一批「便于 Agent 注入」的信息，与账号基础字段、会话原文解耦。典型内容包括：
  - **稳定事实**：职业/年级、可用学习时间、时区与偏好时段、技术栈与基础、语言偏好、设备与场景（通勤/桌面）等（用户可填 + 系统从 onboarding 写入）
  - **约束与目标快照**：当前成长地图摘要、硬性约束（deadline、考试日期）、软偏好（不喜欢视频长课等）
  - **行为信号摘要**（非原文）：近期任务完成率、常错题型、活跃时段、连续打卡等聚合指标，供 Prompt 中「环境」段落引用
- **组装方式**：每次调用 Mentor / Advisor / Plan / Exercise 等 Agent 前，由后端按策略从 `user_profiles`、上下文条目表、成长地图与任务进度等 **拼装成固定模板的「环境块」**（System 或独立 user 消息），控制 token 上限（摘要 + Top-K 事实），避免把全量聊天记录塞进上下文。**Advisor 调用时额外注入当前讲义/任务节选**（见 2.2）。
- **Agent 驱动的画像更新**：
  - 在对话结束、日报提交、阶段性任务完成等 **触发点**，由协调侧（可由 Mentor Agent 或独立「画像合成」步骤）基于本轮交互与近期行为 **生成结构化增量**：如学习风格（视觉/实践/理论倾向）、节奏（喜欢短平快 vs 系统课）、动机类型、常见卡点表述等
  - **默认写入策略**：高置信、低敏感字段可自动合并到用户画像；涉及偏好/性格推断或可能偏见的结论，建议以 **「待确认补丁」** 形式落库，前端提示用户一键确认或编辑后再生效
  - **可追溯**：每次自动/半自动更新记录来源（哪次会话、哪条日报）、模型版本与摘要理由，支持用户查看与回滚

### 2.2 Agent能力
- Mentor Agent：多风格Prompt模板，支持AI/真人切换，历史对话上下文管理，负责接收用户成长诉求并协调其他Agent；调用前注入 **User Context Pack**，会话或里程碑结束后触发 **画像/上下文摘要更新**（见 2.1 用户环境上下文与动态画像）
- **Advisor Agent（学习顾问）**：面向「正在学」场景的 **即时答疑**，用户遇到不懂可随时提问（概念拆解、步骤指引、例题思路、代码/报错解读、错题分析）。与 Mentor 分工：**Mentor** 偏成长路径、动机、地图调整与跨阶段规划；**Advisor** 偏 **当前任务/当前讲义范围内** 的讲透与练会。默认注入 **User Context Pack** + **当前 `task_id` / `lesson_id` 及讲义相关节选**（用户可选中段落一并上传）；支持 **流式输出**、低延迟体验；遇 **时效性或超纲** 问题可经工具调用触发 **Research Agent** 检索后再答（引用来源需明示）。会话可与 Mentor **分轨存储**（避免打乱长期 coaching 线程），可选将高频卡点 **摘要同步** 给 Mentor/画像（用户确认或自动低风险字段）
- Research Agent：网络资料搜索与整理能力，对接搜索API（如Perplexity、Tavily、Serper等），收集成长路径相关的学习资源、最佳实践、行业趋势等
- Plan Agent：成长地图自动生成与动态调整，支持阶段性目标与任务拆解，基于 Research 资料与 **User Context Pack / 用户画像** 生成个性化成长路径
- Knowledge Agent：知识图谱构建，知识点可视化；**负责（或与 Tutor Content 子流程配合）按任务生成学习文档/讲义**，含引用来源与版本迭代
- Exercise Agent：题库/实践任务生成，自动批改与点评，错题本/反思记录

### 2.3 成长地图与任务
- 地图生成流程：
  1. 用户输入成长诉求（如"我想成为全栈工程师"），后端附带当前 **User Context Pack**（事实、约束、行为摘要）供 Mentor / Research / Plan 使用
  2. Mentor Agent 派发任务给 Research Agent，收集相关学习路径、技术栈、行业要求等资料
  3. Research Agent 完成资料收集后，Mentor Agent 调用 Plan Agent 规划成长地图
  4. 用户在前端查看并调整成长地图（拖拽、增删、修改阶段/任务）
  5. 用户确认后，系统自动 **预生成或按日程生成学习文档**，并生成定时任务（计划推送、**讲义送达**、检验、日报提醒等）
- 地图结构：阶段（入门/进阶/精通）-目标-任务-反馈
- **环节学习数据与 Agent Tool**：除保存地图拓扑外，持久化各阶段/目标/任务上的 **学习过程与结果**（进度、讲义阅读、测验与练习、与 Advisor 互动摘要、关联日报等）；各 Agent（Mentor / Advisor / Plan 等）通过 **结构化 Tool（function calling）** 按需查询学情，与 **User Context Pack** 互补——Context 偏稳定事实与偏好，学情 Tool 偏 **动态过程数据**，用于诊断卡点、调整路径与讲解策略
- 任务类型：学习（阅读/视频/实践）、检验（测验/项目/代码审查）、反思（日报/周报）
- 任务进度与定时提醒（支持日历/推送/邮件/IM）
- 定时任务配置：支持自定义时间、频率、提醒方式

#### 家教式全套交付：学习计划 + 学习文档
- **定位**：不只推送「今天学什么」一句话，而是像家教一样提供 **可打开的完整学习材料**，与成长地图上的 **任务（task）** 一一对应或可合并为「周单元讲义」。
- **学习文档（讲义）典型结构**（Markdown 为主，便于渲染与 diff）：
  - **本节目标**、**先修回顾**（1～2 段）
  - **核心概念与要点**（分条、小标题）
  - **手把手步骤**（带检查点：做完这一步应能回答什么问题）
  - **示例 / 小练习**（代码片段、计算题、情景题等，依领域而定）
  - **常见误区与排错**
  - **延伸阅读**：内部小节 + **外部权威链接**（来自 Research 引用，需标注来源，避免侵权：摘要 + 链接，少全文搬运）
  - **与本地图的衔接**：对应任务 ID、预计耗时、建议学习时段
- **生成时机**：
  - **地图确认后批量预生成**下一阶段讲义（用户开箱即有一整套材料）；或
  - **按定时任务提前 N 小时/天生成**当日讲义，结合最新日报与画像做轻量修订（降本与新鲜度平衡）
- **触达方式**：App 内「学习空间」列表/详情；推送内带 **直达讲义链接**；邮件/IM 可发摘要 + 链接；可选 **导出 PDF**（服务端渲染或第三方 API）；**讲义页/任务页内嵌「问顾问」**，自动携带本节上下文，实现家教式随问随答
- **迭代**：用户标记「太难/太水」、测验错题、Mentor 对话反馈可触发 **讲义补丁版本**（`version` + 变更说明），保留历史版本便于追溯

### 2.4 日报与激励
- 日报提交与自动生成（AI摘要/点评）
- 周/月成长报告（数据可视化）
- 成就系统（徽章、积分、排行榜）

### 2.5 社区与互助
- 学伴/小组功能，互评互助
- 达人答疑/真人导师接口
- 讨论区/经验分享

### 2.6 数据安全与隐私
- 用户数据加密存储
- 隐私协议与数据导出/删除接口（含环境上下文条目、画像变更历史、**学习讲义与附件元数据**、**顾问/Mentor 会话记录**一并导出/删除；对象存储文件按策略删除或匿名化）

### 2.7 商业化
- 会员体系、付费功能、导师分成
- API调用计费与限流

## 3. 关键技术点
- **用户环境注入与画像演化**：上下文分层（事实 / 约束 / 行为摘要）、按需拼装 Context Pack、Token 预算与定期摘要；画像字段 Schema 化（JSON），支持 Agent 输出 **增量补丁** + 人工确认与版本历史
- 多Agent协作：Mentor Agent 作为协调者，派发任务给 Research/Plan/Knowledge/Exercise Agent，支持并行/串行执行；**Advisor** 可独立入口高频调用，必要时 **回查 Research** 再答
- **Advisor 工程化**：讲义节选裁剪（按标题/锚点/选中范围）、多轮会话滑动窗口、**限流与滥用防护**（会员/次数包）、与 Exercise 错题联动（用户从错题一键发起追问）
- 网络搜索能力：对接搜索API（Perplexity AI、Tavily Search、Serper、Exa等），需购买API密钥，支持多源聚合与去重
- 多Agent对话管理：上下文缓存、分角色Prompt、会话多路复用
- 成长地图算法：基于用户画像、目标和Research Agent收集的资料，自动推荐成长路径，支持用户自定义调整
- **成长地图 + 学情 Tool**：地图与 `task_progress`、学习事件流（如 `learning_events`）协同；Agent 通过只读 Tool 拉取聚合进度与近期事件，指导方案与前端进度展示 **同源查询**，避免 Prompt 堆砌过时状态
- AI能力扩展：支持多模型切换，Prompt工程可配置，支持插件式扩展
- 定时任务/推送：基于 node-cron/bullmq，支持成长地图确认后自动生成学习、检验、日报等定时任务，支持多渠道推送；**推送内容与讲义绑定**（同一封通知内：今日目标 + 讲义入口）
- **学习文档工程**：Markdown 存储与渲染（如 react-markdown + 代码高亮）、引用来源结构化存储、对象存储存附件/导出 PDF；大文档分块生成与拼装，控制单次模型输出与成本
- 知识图谱：可选Neo4j/自建图数据库，支持知识点关联与可视化
- 安全合规：OAuth2.0鉴权、HTTPS全链路加密、敏感数据脱敏

## 4. 部署与启动体验
- 一体化全栈项目，所有服务可通过 `npm install && npm run dev` 一键启动，无需手动配置数据库、反向代理等复杂步骤。
- 默认内置 SQLite/JSON 文件存储，支持零配置本地开发，生产环境可切换为云数据库。
- 提供 `.env.example`，仅需复制为 `.env` 即可本地运行。
- 所有依赖通过 npm/yarn/pnpm 管理，自动安装。
- 支持 Vercel/Netlify/Render/Cloudflare 等一键云部署，文档中给出详细步骤。
- 提供 mock 数据和演示账号，clone 后即刻体验全部功能。

## 5. 搜索API选型与成本
| API服务 | 特点 | 定价 | 推荐场景 |
|---------|------|------|----------|
| Perplexity AI | 高质量答案，支持引用来源 | $5/1000次（标准）、$20/1000次（Pro） | 深度研究、学习路径规划 |
| Tavily Search | 专为AI设计，结构化结果 | $0.005/次（基础）、$0.01/次（高级） | 高频搜索、资源收集 |
| Serper API | Google搜索结果，快速稳定 | $50/5000次（约$0.01/次） | 通用搜索、资讯获取 |
| Exa (Metaphor) | 语义搜索，适合技术内容 | $0.01/次 | 技术文档、代码示例 |

推荐组合：Tavily（日常搜索）+ Perplexity（深度研究），预算约 $20-50/月（中小规模用户）

## 6. 迭代建议
- MVP优先实现：
  - 用户-Mentor Agent对话
  - **Advisor Agent 即时答疑**（讲义/任务上下文注入 + 流式回复；Research 工具调用可二期）
  - **User Context Pack 存储与注入**（onboarding + 用户可编辑事实；对话前拼装环境块）
  - **画像/学习风格：Agent 结构化总结 + 待确认合并**（至少覆盖日报与关键会话节点）
  - Research Agent网络搜索能力（对接1-2个搜索API）
  - 成长地图自动生成（Mentor → Research → Plan 协作流程）
  - 用户确认成长地图后自动生成定时任务
  - **学习任务配套讲义**（至少 Markdown 在线阅读 + 推送带链接；PDF 可二期）
  - 日报与任务提醒
- 后续扩展：知识图谱、社区互助、真人导师、商业化模块

---

# 技术选型与详细架构

## 1. 技术栈

### 前端
- 框架：Next.js 14（React 18 + App Router，支持 SSR/SSG/CSR，极致开发体验）
- 语言：TypeScript
- UI：shadcn/ui 或 Ant Design（可选 Tailwind CSS）
- **学习侧 UX**：讲义/任务页 **侧栏或底部抽屉「问顾问」**，支持选中讲义片段发起追问；与 Mentor 入口区分（文案与路由不同，避免用户混淆）
- 状态管理：Zustand 或 Redux Toolkit
- 网络请求：SWR/React Query
- 鉴权：NextAuth.js
- 打包/部署：Vercel/Netlify/自托管

### 后端
- 方案1：Next.js API Route（同仓库，Node.js原生，适合一体化部署）
- 方案2：独立 Node.js (Express/NestJS) 服务（适合复杂业务拆分）
- 语言：TypeScript
- 任务调度：node-cron/bullmq（Redis）
- AI对接：openai、deepseek、@anthropic-ai/sdk 等官方/社区 npm 包
- 搜索API：Perplexity AI、Tavily Search API、Serper API、Exa API（需购买API密钥）
- 数据库：Prisma ORM + SQLite（本地）/PostgreSQL（生产）
- 文件存储：本地/Cloud Object Storage（如 S3），用于讲义附件、导出 PDF、大体积附录
- 学习文档：Markdown 正文可存 DB；长文或 PDF 可存 S3；前端可用 MDX/react-markdown、Shiki 高亮；可选 `@react-pdf` / headless Chromium 导出 PDF

### 其它
- IM Bot：node-telegram-bot-api、wechaty、钉钉/飞书SDK
- 知识图谱：Neo4j（可选）、vis-network 前端可视化
- 日志/监控：winston/log4js + Sentry/Prometheus
- 部署：Docker + Compose，支持 Bun/Node.js

## 2. 关键调用链路

### 2.1 用户与 Mentor Agent 对话
1. 用户在前端（Next.js页面）输入问题，点击发送
2. 前端通过 fetch/SWR 调用 `/api/agent/mentor`（Next.js API Route）
3. API Route 校验用户身份，**读取并拼装 User Context Pack**（画像摘要、关键事实、当前地图与任务摘要等），与近期会话摘要一并写入 prompt
4. 记录上下文，组装完整 prompt（环境块 + 业务指令 + 用户消息）
5. 调用 AI SDK（如 openai.chat.completions.create）
6. AI 返回流式/完整响应，API Route 处理后推送给前端（SSE/Fetch流/WS）
7. 前端实时渲染回复，存入本地/云端会话历史
8. （可选，异步）本轮结束后触发 **画像/上下文增量提取**，生成待确认补丁或自动合并低风险字段

### 2.2 成长地图生成与动态调整（完整流程）
1. 用户输入成长诉求，前端 POST `/api/growth/request`，带上用户画像/目标/当前水平
2. Mentor Agent 接收请求，派发任务给 Research Agent：POST `/api/agent/research`
3. Research Agent 调用搜索API（Perplexity/Tavily/Serper等），收集学习路径、技术栈、行业要求、优质资源等
4. Research Agent 返回整理后的资料，Mentor Agent 调用 Plan Agent：POST `/api/agent/plan`
5. Plan Agent 基于用户画像、目标和Research资料，生成成长地图（阶段-目标-任务）
6. 结果存入数据库（Prisma），返回前端渲染，状态为"待确认"
7. 用户在前端查看并调整（拖拽、增删、修改阶段/任务），前端 PATCH `/api/plan/:id`
8. 用户确认成长地图，前端 POST `/api/plan/:id/confirm`
9. 后端 **为学习任务生成或排队生成学习文档（讲义）**（调用 Knowledge/教案流程，写入 `learning_lessons` 或等价表，关联 `growth_task_id`），可批量预生成或按日程懒生成
10. 后端根据成长地图自动生成定时任务：
   - 学习任务（每日/每周推送 **学习计划摘要 + 对应讲义链接/入口**）
   - 检验任务（阶段性测验/项目/代码审查）
   - 日报提醒（每日晚上提醒填写学习日报）
11. 定时任务通过 node-cron/bullmq 调度，推送到前端/邮箱/IM

### 2.3 日报与激励
1. 用户提交日报，前端 POST `/api/report`
2. 后端存储日报，调用 AI 生成摘要/点评，返回前端
3. 周/月自动统计，API 定时任务生成成长报告，推送到前端/邮箱/IM

### 2.4 任务与定时提醒
1. 用户在成长地图上领取/完成任务，前端 PATCH `/api/task/:id`
2. 后端更新任务状态，触发激励（徽章/积分）
3. node-cron/bullmq 定时检查未完成任务，推送提醒（Web/IM/邮件）

### 2.5 社区与互助
1. 用户加入小组，前端调用 `/api/group/join`
2. 组内消息/互评通过 WebSocket/IM Bot 实时推送
3. 达人答疑/真人导师通过专属 API Route 对接

### 2.6 用户与 Advisor Agent（学习顾问）即时答疑
1. 用户在 **讲义页/任务页/错题页** 打开「问顾问」，输入问题（可选附带选中段落、代码、报错栈）
2. 前端调用 `/api/agent/advisor`（或等价路径），请求体携带 `lesson_id` / `task_id` / `exercise_attempt_id` 等 **学习锚点**
3. API Route 校验身份，拼装 **User Context Pack** + **讲义节选**（按锚点裁剪，控制 token）+ 近期 **Advisor 会话**（同一会话 `thread_id` 多轮）
4. 调用 AI SDK，**流式**返回解答；若启用工具调用且模型判断需要外部资料，则内部调用 Research，再汇总为带引用的回答
5. 消息落库（`advisor_messages` 或统一 `chat_messages` 带 `channel=advisor`），供续聊与合规导出
6. （可选）异步提取「本轮卡点摘要」，写入待确认画像补丁或同步给 Mentor 线程

## 3. 典型数据流与安全
- 所有 API Route 统一鉴权（NextAuth.js/JWT），用户数据加密存储
- AI调用敏感信息脱敏，日志仅存摘要
- 支持 GDPR/数据导出/删除

## 4. 本地开发与一键启动
- `bun install` 或 `npm install` 安装依赖
- `bun dev` 或 `npm run dev` 启动前后端一体服务
- 默认 SQLite/JSON 文件存储，无需额外依赖
- `.env.example` 一键配置
- mock 数据/演示账号开箱即用

## 5. 生产部署
- 推荐 Vercel/Netlify 一键部署（自动 CI/CD）
- 支持 Docker Compose 部署，环境变量灵活切换
- 日志/监控/告警集成

---

## 6. 完整用户旅程示例：从诉求到成长地图

### 场景：用户想成为全栈工程师

#### 第一步：用户输入成长诉求
```
用户：我是一名后端工程师（3年Java经验），想转型成为全栈工程师，希望在6个月内掌握前端开发能力。
```

#### 第二步：Mentor Agent 派发任务给 Research Agent
```
Mentor Agent → Research Agent:
- 任务：收集全栈工程师学习路径
- 关键词：前端开发、React/Vue、全栈技术栈、后端转前端
- 用户背景：3年Java经验
```

#### 第三步：Research Agent 网络搜索
调用搜索API（Tavily/Perplexity），收集：
- 全栈工程师技能树（HTML/CSS/JS、React/Vue、Node.js、数据库、DevOps等）
- 后端转前端最佳实践（利用已有后端知识，快速上手前端）
- 优质学习资源（MDN、React官方文档、freeCodeCamp等）
- 行业要求（招聘JD分析、技术趋势）

#### 第四步：Plan Agent 生成成长地图
基于Research资料 + 用户画像，生成：
```
阶段1：前端基础（0-2个月）
  目标1：掌握HTML/CSS/JavaScript核心
    - 任务1.1：学习HTML5语义化标签（1周）
    - 任务1.2：学习CSS布局（Flexbox/Grid）（1周）
    - 任务1.3：学习JavaScript ES6+（2周）
    - 检验1：完成个人博客页面（静态）
  目标2：掌握前端工程化
    - 任务2.1：学习npm/webpack/vite（1周）
    - 任务2.2：学习Git工作流（1周）
    - 检验2：搭建前端开发环境

阶段2：React框架（2-4个月）
  目标3：掌握React核心
    - 任务3.1：学习React组件、Hooks（2周）
    - 任务3.2：学习状态管理（Redux/Zustand）（1周）
    - 任务3.3：学习React Router（1周）
    - 检验3：完成Todo应用（带路由和状态管理）
  目标4：掌握前后端交互
    - 任务4.1：学习RESTful API调用（1周）
    - 任务4.2：学习GraphQL（可选）（1周）
    - 检验4：对接后端API，完成用户管理系统

阶段3：全栈项目（4-6个月）
  目标5：独立完成全栈项目
    - 任务5.1：设计项目架构（前后端分离）（1周）
    - 任务5.2：开发前端（React + TypeScript）（3周）
    - 任务5.3：开发后端（Node.js/Java）（2周）
    - 任务5.4：部署上线（Docker + CI/CD）（1周）
    - 检验5：完成个人全栈项目（如博客系统、电商平台等）
```

#### 第五步：用户确认并调整
- 用户在前端拖拽调整任务顺序
- 删除"学习GraphQL"（暂不需要）
- 增加"学习TypeScript"（公司要求）

#### 第六步：系统自动生成定时任务
用户点击"确认成长地图"后，系统自动创建：

**学习任务**（每日推送 + **配套讲义**）
```
- 每天早上9点：推送当日学习（如「今日主题：JavaScript 闭包」）+ **App 内打开《闭包与作用域》讲义**（含步骤、示例、误区、延伸阅读）
- 每周一：推送本周学习计划 + **本周单元讲义目录/打包入口**
- 讲义与 `growth_tasks` 关联；用户未读可再次提醒（可选）
```

**检验任务**（阶段性）
```
- 第2周末：提交个人博客页面（静态）
- 第4周末：提交前端开发环境截图
- 第8周末：提交Todo应用代码仓库
- ...
```

**日报提醒**（每日）
```
- 每天晚上8点：提醒填写学习日报
  - 今天学了什么？
  - 遇到什么问题？
  - 明天计划学什么?
```

**周报/月报**（定期）
```
- 每周日：生成本周学习总结（AI自动摘要）
- 每月底：生成成长报告（进度、成就、建议）
```

#### 第七步：持续学习与反馈
- 用户每天收到学习推送，**先读讲义再按任务打卡**；卡壳处优先用 **Advisor** 即时问清，再必要时找 **Mentor** 调整节奏或改地图
- 系统记录学习进度，自动调整成长地图（如发现某模块学习困难，增加练习任务）
- Mentor Agent 定期回顾，给出个性化建议
- **行为摘要与画像**：定时或事件驱动更新 `user_context_items` 中的行为摘要；在日报/里程碑后由 Agent 产出画像补丁，经确认后写入 `user_profiles`，使下一轮 **Context Pack** 更贴合用户

---

## 7. 数据库表结构设计（核心表）

### users（用户表）
```sql
id, email, password, name, avatar, role, created_at, updated_at
```

### user_profiles（用户画像，含 Agent 可更新字段）
```sql
id, user_id, current_level, interests, goals, background,
learning_style_json, traits_json, motivation_notes,
agent_summary, profile_version, last_synthesized_at,
created_at, updated_at
```
说明：`learning_style_json` / `traits_json` 建议固定 Schema（如偏好媒介、节奏、反馈风格）；`agent_summary` 为短文本供快速注入；`profile_version` 便于与变更历史对照。

### user_context_items（用户环境上下文条目，Agent 注入的主要来源之一）
```sql
id, user_id, category(fact/constraint/preference/behavior_summary/goal_snapshot),
title, content_text, content_json, source(user/agent/system/import),
confidence, pinned, expires_at, created_at, updated_at
```
说明：高价值事实可 `pinned`；过期资讯用 `expires_at`；`behavior_summary` 由离线/定时任务从任务与日报聚合写入，避免在对话里重复长文。

### user_context_pack_cache（可选，上下文包缓存）
```sql
id, user_id, pack_hash, rendered_text, token_estimate, built_at, invalidates_on
```
说明：画像或上下文条目变更时置失效，减少每次请求重复拼装与重复摘要。

### profile_update_proposals（Agent 提出的画像/上下文补丁，待确认或自动合并）
```sql
id, user_id, proposal_json, source_session_id, source_report_id,
status(pending/auto_merged/rejected/accepted), reviewer_note, created_at, resolved_at
```
说明：`proposal_json` 为结构化 patch（改哪些字段、新值、理由）；用户在前端确认后写入 `user_profiles` / `user_context_items` 并更新 `profile_version`。

### profile_change_history（画像与关键上下文变更审计）
```sql
id, user_id, field_path, old_value_json, new_value_json,
change_type(user_manual/agent_auto/agent_confirmed), proposal_id, created_at
```

### growth_requests（成长诉求）
```sql
id, user_id, request_text, status(pending/researching/planning/confirmed), created_at, updated_at
```

### research_results（研究结果）
```sql
id, request_id, agent_id, search_query, results_json, sources, created_at
```

### growth_maps（成长地图）
```sql
id, request_id, user_id, title, description, status(draft/confirmed/active/completed), created_at, updated_at
```

### growth_stages（成长阶段）
```sql
id, map_id, stage_order, title, description, duration_weeks, created_at
```

### growth_goals（成长目标）
```sql
id, stage_id, goal_order, title, description, created_at
```

### growth_tasks（成长任务）
```sql
id, goal_id, task_order, title, description, type(learn/practice/test/reflect), duration_days, resources_json, created_at
```
说明：`resources_json` 可存外链；**主讲义**建议用 `learning_lessons.task_id` 关联，避免大正文塞进 JSON。

### learning_lessons（学习讲义/文档，家教式材料）
```sql
id, user_id, map_id, task_id, title, slug,
content_markdown, outline_json, sources_json,
artifact_url, pdf_url,
version, parent_lesson_id, changelog,
status(draft/generating/published/archived),
generated_by, model_id, created_at, updated_at
```
说明：`sources_json` 存引用列表（标题、URL、摘录范围）；`artifact_url` 存可选附件（图、代码包）；用户反馈后可升 `version` 并保留 `parent_lesson_id` 链。

### scheduled_tasks（定时任务）
```sql
id, map_id, user_id, task_type(learn/check/daily_report/lesson_reminder), cron_expression, content_json, status(active/paused/completed), created_at
```
说明：`content_json` 可含 `lesson_id`、`push_channels`、`summary`；`lesson_reminder` 用于「到点推送：今日计划 + 讲义入口」。

### daily_reports（日报）
```sql
id, user_id, map_id, date, learned, problems, plan_tomorrow, ai_summary, created_at
```

### task_progress（任务进度）
```sql
id, user_id, task_id, status(todo/doing/done), started_at, completed_at, notes
```

### learning_events（环节学习事件流，供聚合展示与 Agent Tool 查询）
```sql
id, user_id, map_id, stage_id, goal_id, task_id,
type(lesson_open/exercise_submit/task_status/daily_report_linked/advisor_summary/...),
payload_json, created_at
```
说明：与 `task_progress` 双写或先事件后异步汇总；各 Agent 通过 **只读 Tool** 按 `map_id`/`task_id`/时间窗查询，避免仅靠长上下文描述学情。

### map_learning_rollups（可选，地图级学情缓存）
```sql
id, map_id, user_id, summary_json, updated_at
```
说明：定时任务刷新，降低高频 Tool 全表扫描；可与 `GET /plan/:id/progress` 共用。

### advisor_threads（顾问会话线程，与 Mentor 分轨）
```sql
id, user_id, map_id, task_id, lesson_id, exercise_attempt_id,
title, last_message_at, created_at, updated_at
```

### advisor_messages（顾问消息；也可合并为通用 chat 表 + channel）
```sql
id, thread_id, user_id, role(user/assistant/tool), content_text, content_json,
model_id, token_usage_json, created_at
```

---

如需更细致的某一链路、接口定义、Prompt模板等，可随时补充！
