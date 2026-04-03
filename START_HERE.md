# 🚀 开始发布 Mentor Agent

欢迎！这个文档将指导你快速将 mentor-agent 发布为独立的 GitHub 仓库。

## 📖 你需要什么

1. **GitHub 账号** - 用于创建新仓库
2. **git-filter-repo** - 用于提取 Git 历史（推荐）
3. **5-10 分钟时间** - 完成整个发布流程

## 🎯 三种发布方式

### 方式 1：一键自动化（最简单）⭐

```bash
cd /Users/yidong.lan/go-work/mentor-agent
./scripts/prepare-release.sh
```

脚本会自动：
- ✅ 提取完整 Git 历史
- ✅ 清理不需要的文件
- ✅ 运行质量检查（lint、test、build）
- ✅ 配置远程仓库

**适合**：想要快速发布且保留历史的用户

### 方式 2：跟随快速指南（5 分钟）

查看 [`docs/QUICK_START_PUBLISH.md`](docs/QUICK_START_PUBLISH.md)

包含：
- 📝 详细的步骤说明
- 🔧 手动操作命令
- ❓ 常见问题解答

**适合**：想要了解每一步操作的用户

### 方式 3：完整文档（深入理解）

查看 [`docs/PUBLISHING.md`](docs/PUBLISHING.md)

包含：
- 📚 两种发布方案对比
- 🛠️ 详细的技术说明
- 🔐 安全最佳实践
- 🔄 后续维护指南

**适合**：想要深入了解发布流程的用户

## 📋 发布前检查

在开始之前，请确认：

- [ ] 已安装 `git-filter-repo`（`brew install git-filter-repo`）
- [ ] 已在 GitHub 创建新仓库（或准备创建）
- [ ] 已检查 `.env.example` 无敏感信息
- [ ] 已更新 `package.json` 中的作者信息

完整检查清单：[`PUBLISH_CHECKLIST.md`](PUBLISH_CHECKLIST.md)

## 🚀 快速开始（30 秒）

```bash
# 1. 安装依赖（如果还没安装）
brew install git-filter-repo

# 2. 运行发布脚本
cd /Users/yidong.lan/go-work/mentor-agent
./scripts/prepare-release.sh

# 3. 按照提示操作
# - 选择方案 1（保留历史）
# - 输入 GitHub 仓库 URL
# - 等待完成

# 4. 推送到 GitHub
cd /tmp/mentor-agent-new  # 或你指定的目录
git push -u origin main
```

## 📚 文档结构

```
mentor-agent/
├── START_HERE.md              ← 你在这里！
├── PUBLISH_CHECKLIST.md       ← 完整检查清单
├── README.md                  ← 项目介绍
├── LICENSE                    ← MIT 许可证
├── CONTRIBUTING.md            ← 贡献指南
├── CHANGELOG.md               ← 版本记录
│
├── docs/
│   ├── QUICK_START_PUBLISH.md ← 5 分钟快速指南
│   ├── PUBLISHING.md          ← 完整发布文档
│   └── README.md              ← 文档索引
│
├── scripts/
│   └── prepare-release.sh     ← 自动化发布脚本
│
└── .github/
    ├── workflows/ci.yml       ← CI/CD 配置
    ├── ISSUE_TEMPLATE/        ← Issue 模板
    └── pull_request_template.md ← PR 模板
```

## 🎓 推荐流程

### 新手用户

1. 阅读本文档（你已经在读了！）
2. 查看 [`PUBLISH_CHECKLIST.md`](PUBLISH_CHECKLIST.md)
3. 运行 `./scripts/prepare-release.sh`
4. 完成！

### 有经验用户

1. 查看 [`docs/QUICK_START_PUBLISH.md`](docs/QUICK_START_PUBLISH.md)
2. 手动执行命令
3. 自定义配置

### 高级用户

1. 阅读 [`docs/PUBLISHING.md`](docs/PUBLISHING.md)
2. 根据需求选择方案
3. 自定义工作流

## ⚠️ 重要提醒

### 发布前必做

1. **检查敏感信息**
   - `.env` 文件已在 `.gitignore` 中
   - `.env.example` 不包含真实密钥
   - 代码中无硬编码密钥

2. **更新配置**
   - `package.json` 中的作者和仓库 URL
   - README.md 中的示例 URL

3. **运行测试**
   ```bash
   pnpm lint   # 代码检查
   pnpm test   # 运行测试
   pnpm build  # 构建项目
   ```

### 发布后建议

1. **创建 Release**
   - Tag: `v0.1.0`
   - 包含功能说明

2. **配置仓库**
   - 添加 Topics
   - 启用 Issues
   - 设置 branch protection

3. **添加 Badges**
   - CI 状态
   - License
   - Node.js 版本

## 🆘 需要帮助？

### 遇到问题？

1. 查看 [`docs/QUICK_START_PUBLISH.md`](docs/QUICK_START_PUBLISH.md) 的"常见问题"部分
2. 查看 [`docs/PUBLISHING.md`](docs/PUBLISHING.md) 的详细说明
3. 检查 GitHub Actions 日志（发布后）

### 脚本失败？

```bash
# 查看错误信息
cat /tmp/mentor-agent-new/error.log

# 手动执行（参考 QUICK_START_PUBLISH.md）
cd /tmp
git clone /Users/yidong.lan/go-work mentor-agent-new
cd mentor-agent-new
git filter-repo --path mentor-agent/ --path-rename mentor-agent/:
```

## 📞 联系方式

- 提交 Issue（发布后）
- 查看文档
- 参考 CONTRIBUTING.md

## ✨ 准备好了吗？

选择你的方式开始：

1. **快速自动化** → 运行 `./scripts/prepare-release.sh`
2. **跟随指南** → 打开 [`docs/QUICK_START_PUBLISH.md`](docs/QUICK_START_PUBLISH.md)
3. **深入学习** → 阅读 [`docs/PUBLISHING.md`](docs/PUBLISHING.md)

---

**祝你发布顺利！** 🎉

如果成功发布，别忘了：
- ⭐ Star 你的新仓库
- 📢 分享给朋友
- 🎨 添加漂亮的 README badges
