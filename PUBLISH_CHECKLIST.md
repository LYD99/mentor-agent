# 发布检查清单

## ✅ 已完成的准备工作

### 核心文档
- [x] `README.md` - 项目介绍和使用说明
- [x] `LICENSE` - MIT 许可证
- [x] `CONTRIBUTING.md` - 贡献指南
- [x] `CHANGELOG.md` - 版本变更记录

### 发布指南
- [x] `docs/QUICK_START_PUBLISH.md` - 5 分钟快速发布指南
- [x] `docs/PUBLISHING.md` - 完整发布流程文档
- [x] `docs/README.md` - 文档索引

### 自动化工具
- [x] `scripts/prepare-release.sh` - 自动化发布脚本（已添加执行权限）
- [x] `.github/workflows/ci.yml` - CI/CD 配置

### GitHub 模板
- [x] `.github/ISSUE_TEMPLATE/bug_report.md` - Bug 报告模板
- [x] `.github/ISSUE_TEMPLATE/feature_request.md` - 功能请求模板
- [x] `.github/pull_request_template.md` - PR 模板

### 配置文件
- [x] `package.json` - 已更新仓库信息、作者、关键词
- [x] `.gitignore` - 已更新，排除敏感信息和个人笔记
- [x] `.env.example` - 环境变量模板（已存在）

## 📋 发布前必做事项

### 1. 更新配置信息

编辑 `package.json`，替换以下占位符：

```json
{
  "author": "Your Name <your.email@example.com>",  // 改为你的信息
  "repository": {
    "url": "https://github.com/yourusername/mentor-agent.git"  // 改为实际 URL
  },
  "bugs": {
    "url": "https://github.com/yourusername/mentor-agent/issues"  // 改为实际 URL
  },
  "homepage": "https://github.com/yourusername/mentor-agent#readme"  // 改为实际 URL
}
```

### 2. 检查敏感信息

- [ ] 检查 `.env` 文件是否在 `.gitignore` 中
- [ ] 确认 `.env.example` 不包含真实的 API keys
- [ ] 检查代码中是否有硬编码的密钥或密码
- [ ] 确认 `mythinking/` 目录不会被提交（已在 .gitignore 中）

### 3. 代码质量检查

```bash
cd /Users/yidong.lan/go-work/mentor-agent

# 运行 lint
pnpm lint

# 运行测试
pnpm test

# 运行构建
pnpm build
```

### 4. 文档检查

- [ ] README.md 中的安装步骤是否正确
- [ ] 所有链接是否有效
- [ ] 截图和示例是否最新
- [ ] API 文档是否完整（如果有）

## 🚀 发布步骤

### 快速发布（推荐）

```bash
# 1. 在 GitHub 创建新仓库（不要初始化）
# 访问 https://github.com/new

# 2. 运行自动化脚本
cd /Users/yidong.lan/go-work/mentor-agent
./scripts/prepare-release.sh

# 3. 按提示操作
# - 选择方案 1（保留历史）
# - 输入目标目录（默认 /tmp/mentor-agent-new）
# - 输入 GitHub 仓库 URL

# 4. 推送到 GitHub
cd /tmp/mentor-agent-new  # 或你指定的目录
git branch -M main
git push -u origin main
```

### 手动发布（备选）

参考 `docs/QUICK_START_PUBLISH.md` 中的手动步骤。

## 📦 发布后操作

### 1. GitHub 仓库配置

- [ ] 添加仓库描述和网站
- [ ] 添加 Topics: `ai`, `education`, `nextjs`, `typescript`, `tutoring`
- [ ] 启用 Issues
- [ ] 启用 Discussions（可选）
- [ ] 设置 branch protection rules

### 2. 创建首个 Release

```bash
# 在新仓库中
git tag -a v0.1.0 -m "Initial release"
git push origin v0.1.0
```

然后在 GitHub 创建 Release：
- 访问 `https://github.com/yourusername/mentor-agent/releases/new`
- 选择 tag `v0.1.0`
- 填写 Release notes（参考 CHANGELOG.md）

### 3. 添加 Badges 到 README（可选）

在 README.md 顶部添加：

```markdown
[![CI](https://github.com/yourusername/mentor-agent/workflows/CI/badge.svg)](https://github.com/yourusername/mentor-agent/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
```

### 4. 配置 GitHub Actions

CI workflow 已配置在 `.github/workflows/ci.yml`，首次推送后会自动运行。

### 5. 邀请协作者（如果有）

Settings → Collaborators → Add people

## 🔄 后续维护

### 版本发布流程

1. 更新代码
2. 更新 CHANGELOG.md
3. 更新版本号：`npm version patch|minor|major`
4. 推送：`git push && git push --tags`
5. 在 GitHub 创建 Release

### 同步开发（如果需要）

如果你还在 go-work 中开发：

```bash
# 在 go-work/mentor-agent 中
git remote add standalone https://github.com/yourusername/mentor-agent.git

# 推送改动到独立仓库
git push standalone main
```

或者反过来，在独立仓库开发，定期同步回 go-work。

## 📚 参考文档

- [快速发布指南](docs/QUICK_START_PUBLISH.md) - 5 分钟快速上手
- [完整发布指南](docs/PUBLISHING.md) - 详细步骤和最佳实践
- [贡献指南](CONTRIBUTING.md) - 如何贡献代码

## ❓ 常见问题

### Q: 如何删除已提交的敏感信息？

```bash
# 使用 git-filter-repo
git filter-repo --path .env --invert-paths

# 或使用 BFG
brew install bfg
bfg --delete-files .env
```

### Q: 如何修改 package.json 中的信息？

直接编辑 `package.json`，然后：

```bash
git add package.json
git commit -m "chore: update package info"
git push
```

### Q: 如何添加新的文档？

在 `docs/` 目录下创建新的 Markdown 文件，并更新 `docs/README.md`。

## ✨ 完成！

完成以上步骤后，你的 mentor-agent 就成功发布为独立仓库了！

如有问题，请查看详细文档或提交 Issue。
