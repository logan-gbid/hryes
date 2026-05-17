# 上传 GitHub 操作说明

现在只用 Git Bash 上传，不需要 PowerShell。

项目目录：

```bash
/c/Users/Logan/Desktop/codex/hryes-github
```

## 第一次准备

确认已经安装 Git、Node.js、npm 和 GitHub CLI。

如果 Git Bash 里找不到 `gh`，先运行：

```bash
export PATH="/c/Program Files/GitHub CLI:$PATH"
```

如果还没有登录 GitHub CLI，运行：

```bash
gh auth login
```

## 一行命令上传

在 Git Bash 里运行：

```bash
cd /c/Users/Logan/Desktop/codex/hryes-github
./scripts/publish-github.sh hryes
```

`hryes` 是 GitHub 仓库名，可以替换成你想要的名字。

上传完成后，如果不想让账号继续登录在电脑上：

```bash
gh auth logout
```

## 上传前确认

- `.env` 不会上传
- `.preview/` 不会上传
- `node_modules/` 不会上传
- `dist/` 和 `out/` 不会上传
- README 已经是中英文双语版本
- 截图位于 `docs/images/`
