# 发布指南

本文档说明如何将 mentor-agent 作为独立仓库发布。

## 方案选择

有两种方式将 mentor-agent 从 go-work 仓库中分离出来：

### 方案一：保留完整 Git 历史（推荐）

使用 `git filter-repo` 或 `git subtree` 保留 mentor-agent 的提交历史。

#### 使用 git filter-repo（推荐）

1. **安装 git-filter-repo**

```bash
# macOS
brew install git-filter-repo

# 或使用 pip
pip3 install git-filter-repo
```

2. **克隆原仓库**

```bash
cd /tmp
git clone /Users/yidong.lan/go-work mentor-agent-new
cd mentor-agent-new
```

3. **提取 mentor-agent 子目录**

```bash
git filter-repo --path mentor-agent/ --path-rename mentor-agent/:
```

这会：
- 只保留 mentor-agent 目录的历史
- 将 mentor-agent/ 下的内容移到根目录
- 删除所有其他文件的历史

4. **清理和验证**

```bash
# 查看提交历史
git log --oneline

# 查看文件结构
ls -la
```

5. **添加远程仓库并推送**

```bash
# 添加新的远程仓库（先在 GitHub 创建空仓库）
git remote add origin https://github.com/yourusername/mentor-agent.git

# 推送
git push -u origin main
```

#### 使用 git subtree（备选方案）

```bash
# 在原仓库中
cd /Users/yidong.lan/go-work

# 将 mentor-agent 分离为独立分支
git subtree split --prefix=mentor-agent -b mentor-agent-split

# 创建新目录并初始化
cd /tmp
mkdir mentor-agent-new
cd mentor-agent-new
git init

# 拉取分离的分支
git pull /Users/yidong.lan/go-work mentor-agent-split

# 添加远程仓库并推送
git remote add origin https://github.com/yourusername/mentor-agent.git
git push -u origin main
```

### 方案二：全新开始（简单但丢失历史）

如果不需要保留 Git 历史，可以直接复制文件。

```bash
# 创建新目录
cd /tmp
mkdir mentor-agent-new
cd mentor-agent-new

# 初始化 Git
git init

# 复制文件（排除 .git 和 node_modules）
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
  /Users/yidong.lan/go-work/mentor-agent/ .

# 添加所有文件
git add .
git commit -m "Initial commit"

# 添加远程仓库并推送
git remote add origin https://github.com/LYD99/mentor-agent.git
git push -u origin main
```

## 发布前检查清单

### 1. 文件清理

- [ ] 确认 `.gitignore` 正确配置
- [ ] 删除或移动 `mythinking/` 等个人笔记目录
- [ ] 检查是否有敏感信息（API keys、密码等）
- [ ] 确认 `.env.example` 完整且不含真实密钥

### 2. 文档完善

- [ ] README.md 完整且准确
- [ ] LICENSE 文件存在
- [ ] CONTRIBUTING.md 提供贡献指南
- [ ] 添加 CHANGELOG.md（可选）
- [ ] 更新 package.json 中的仓库信息

### 3. 代码质量

- [ ] 运行 `pnpm lint` 确保无错误
- [ ] 运行 `pnpm test` 确保测试通过
- [ ] 运行 `pnpm build` 确保可以构建
- [ ] 检查依赖版本是否合理

### 4. 配置更新

更新 `package.json`：

```json
{
  "name": "mentor-agent",
  "version": "0.1.0",
  "description": "AI-powered intelligent tutoring system",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/mentor-agent.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/mentor-agent/issues"
  },
  "homepage": "https://github.com/yourusername/mentor-agent#readme",
  "keywords": [
    "ai",
    "education",
    "tutoring",
    "learning",
    "nextjs"
  ],
  "author": "Your Name",
  "license": "MIT"
}
```

### 5. GitHub 仓库设置

1. **创建新仓库**
   - 访问 https://github.com/new
   - 仓库名：`mentor-agent`
   - 描述：AI-powered intelligent tutoring system
   - 选择 Public 或 Private
   - 不要初始化 README、.gitignore 或 LICENSE（我们已有）

2. **配置仓库**
   - 添加 Topics: `ai`, `education`, `nextjs`, `typescript`
   - 设置 About 描述
   - 启用 Issues
   - 启用 Discussions（可选）

3. **保护分支**
   - 设置 `main` 分支保护
   - 要求 PR review
   - 要求状态检查通过

4. **添加 GitHub Actions**（可选）

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## 发布步骤

### 完整流程

```bash
# 1. 使用 git filter-repo 提取（推荐方案一）
cd /tmp
git clone /Users/yidong.lan/go-work mentor-agent-new
cd mentor-agent-new
git filter-repo --path mentor-agent/ --path-rename mentor-agent/:

# 2. 清理不需要的文件
rm -rf mythinking/  # 如果不想公开个人笔记
# 编辑 .gitignore 确保正确

# 3. 更新配置文件
# 编辑 package.json、README.md 等

# 4. 提交清理后的更改
git add .
git commit -m "chore: prepare for public release"

# 5. 在 GitHub 创建新仓库（通过网页）

# 6. 添加远程仓库并推送
git remote add origin https://github.com/yourusername/mentor-agent.git
git branch -M main
git push -u origin main

# 7. 创建首个 Release
git tag -a v0.1.0 -m "Initial release"
git push origin v0.1.0
```

### 在 GitHub 创建 Release

1. 访问仓库的 Releases 页面
2. 点击 "Create a new release"
3. 选择 tag `v0.1.0`
4. 标题：`v0.1.0 - Initial Release`
5. 描述发布内容：

```markdown
## 🎉 Initial Release

First public release of Mentor Agent - an AI-powered intelligent tutoring system.

### Features

- 🤖 Multi-agent system (Mentor, Advisor, Research, Plan, Knowledge, Exercise)
- 💬 Real-time streaming conversations
- 📚 Personalized learning path generation
- 📝 Automated learning material creation
- ✅ Exercise generation and grading
- 📊 Learning progress tracking
- 🔔 Scheduled learning reminders

### Tech Stack

- Next.js 15 + TypeScript
- Prisma + SQLite
- Vercel AI SDK
- Tailwind CSS + shadcn/ui

### Getting Started

See [README.md](https://github.com/yourusername/mentor-agent#readme) for installation and usage instructions.
```

## 后续维护

### 版本管理

使用语义化版本（Semantic Versioning）：

- `MAJOR.MINOR.PATCH`
- `1.0.0` - 第一个稳定版本
- `1.1.0` - 添加新功能
- `1.1.1` - Bug 修复

### 发布新版本

```bash
# 更新版本号
npm version patch  # 或 minor, major

# 推送 tag
git push origin main --tags

# 在 GitHub 创建 Release
```

### 保持同步（如果还在 go-work 开发）

如果你还需要在 go-work 中开发，可以：

1. 在 go-work 中开发
2. 定期将改动同步到独立仓库

```bash
# 在 go-work 中
cd /Users/yidong.lan/go-work/mentor-agent

# 添加独立仓库为远程
git remote add standalone https://github.com/yourusername/mentor-agent.git

# 推送改动（需要手动处理路径差异）
```

或者反过来：

1. 在独立仓库中开发
2. 将改动同步回 go-work（如需要）

## 常见问题

### Q: 如何处理敏感信息？

A: 使用 `git filter-repo` 或 BFG Repo-Cleaner 清理历史：

```bash
# 清理特定文件
git filter-repo --path .env --invert-paths

# 清理敏感字符串
git filter-repo --replace-text replacements.txt
```

### Q: 如何选择开源协议？

A: 常见选择：
- MIT - 最宽松，允许商业使用
- Apache 2.0 - 类似 MIT，但有专利保护
- GPL v3 - 要求衍生作品也开源

### Q: 是否需要 CLA（贡献者许可协议）？

A: 个人项目通常不需要。如果是组织项目，可以考虑。

## 参考资源

- [Git Filter Repo](https://github.com/newren/git-filter-repo)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Choose a License](https://choosealicense.com/)
- [GitHub Docs](https://docs.github.com/)
