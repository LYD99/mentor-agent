# 贡献指南

感谢你对 Mentor Agent 项目的关注！我们欢迎所有形式的贡献。

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 在 [Issues](https://github.com/yourusername/mentor-agent/issues) 中搜索是否已有相关问题
2. 如果没有，创建新的 Issue
3. 清晰描述问题或建议，包括：
   - 问题描述
   - 复现步骤（如果是 bug）
   - 期望行为
   - 实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. **Fork 仓库**

   点击页面右上角的 "Fork" 按钮

2. **克隆你的 Fork**

   ```bash
   git clone https://github.com/yourusername/mentor-agent.git
   cd mentor-agent
   ```

3. **创建分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

   分支命名规范：
   - `feature/` - 新功能
   - `fix/` - Bug 修复
   - `docs/` - 文档更新
   - `refactor/` - 代码重构
   - `test/` - 测试相关

4. **安装依赖**

   ```bash
   pnpm install
   ```

5. **进行开发**

   - 遵循项目的代码风格
   - 添加必要的测试
   - 更新相关文档

6. **运行测试**

   ```bash
   pnpm test
   pnpm lint
   ```

7. **提交更改**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   提交信息规范（遵循 Conventional Commits）：
   - `feat:` - 新功能
   - `fix:` - Bug 修复
   - `docs:` - 文档更新
   - `style:` - 代码格式调整
   - `refactor:` - 代码重构
   - `test:` - 测试相关
   - `chore:` - 构建/工具相关

8. **推送到你的 Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

9. **创建 Pull Request**

   - 访问原仓库
   - 点击 "New Pull Request"
   - 选择你的分支
   - 填写 PR 描述，说明：
     - 改动内容
     - 相关 Issue（如有）
     - 测试情况
     - 截图（如有 UI 改动）

## 开发规范

### 代码风格

- 使用 TypeScript
- 遵循 ESLint 配置
- 使用 Prettier 格式化代码
- 组件使用函数式组件和 Hooks

### 文件组织

```
- 组件放在 components/ 目录
- 工具函数放在 lib/ 目录
- API 路由放在 app/api/ 目录
- 类型定义放在相应文件的同目录或 lib/types/
```

### 命名规范

- 组件：PascalCase（如 `ChatMessage.tsx`）
- 函数：camelCase（如 `getUserProfile`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）
- 文件：kebab-case（如 `user-profile.ts`）

### 测试

- 为新功能添加单元测试
- 为 API 添加集成测试
- 测试文件命名：`*.test.ts` 或 `*.test.tsx`
- 测试覆盖率目标：80%+

### 文档

- 为新功能更新 README
- 为复杂函数添加 JSDoc 注释
- 更新 API 文档（如有）

## 项目架构

### 核心模块

1. **Agent 系统** (`lib/agents/`)
   - Mentor: 主导师
   - Advisor: 顾问
   - Research: 研究助手
   - Plan: 规划助手
   - Knowledge: 知识管理
   - Exercise: 练习管理

2. **服务层** (`lib/services/`)
   - 用户服务
   - 会话服务
   - 学习材料服务
   - 进度跟踪服务

3. **API 层** (`app/api/`)
   - RESTful API
   - 流式响应支持

4. **UI 层** (`components/`, `app/`)
   - 聊天界面
   - 学习材料展示
   - 进度可视化

### 数据流

```
用户输入 → API 路由 → Agent 处理 → 服务层 → 数据库
                ↓
            流式响应 → UI 更新
```

## 发布流程

1. 更新版本号（`package.json`）
2. 更新 CHANGELOG
3. 创建 Git tag
4. 推送到 GitHub
5. 创建 Release

## 获取帮助

- 查看 [文档](docs/)
- 提交 [Issue](https://github.com/yourusername/mentor-agent/issues)
- 加入讨论（如有社区）

## 行为准则

- 尊重所有贡献者
- 建设性地讨论问题
- 接受不同观点
- 专注于对项目最有利的方案

## 许可证

提交代码即表示你同意将代码以 MIT 许可证发布。

---

再次感谢你的贡献！🎉
