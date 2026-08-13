# dsh-latex

♾️ Copy and export the LaTeX in DeepSeek Harness

DeepSeek Harness Web UI 插件：悬停任意 LaTeX 公式，即可**复制 TeX 源码**或**导出为独立的 SVG 文件**。

默认的 Web UI 用 KaTeX 渲染公式，但选中即复制的是渲染后的文本，也无法把公式存成矢量图。本插件在渲染后的 DOM 之上加了一层悬浮工具条，不修改核心渲染管线，装/卸都干净。

## 功能

- **复制 LaTeX**：鼠标悬停公式（行内或块级），点击「复制 LaTeX」，TeX 源码即进入剪贴板。源码取自 KaTeX 输出的 MathML `<annotation encoding="application/x-tex">`，与原始输入一致。
- **导出 SVG**：点击「导出 SVG」，公式经 MathJax 渲染为**自包含的矢量图**（字形轮廓内嵌为 path，无外部字体/样式依赖），下载为 `formula-<slug>.svg`，可用于论文、PPT、网页。
- 完全离线可用：MathJax 脚本由插件自身的 host half 提供（`/latex-tools/mathjax`），首次导出时才按需加载，之后浏览器缓存；不依赖任何 CDN。
- 支持行内与块级公式（块级按 display 模式导出）。

## 安装

要求：安装 Node.js，然后直接用官方 npm 方式运行（无需全局安装）：

```sh
npx @deepseek-ai/dsh web
```

Web UI 默认启动在 `http://127.0.0.1:3080`。下文命令均以官方 npm 方式 `npx @deepseek-ai/dsh ...` 给出（无需全局安装）；也可以全局安装（`npm i -g @deepseek-ai/dsh`）后直接用 `dsh ...`，源码环境则用 `pnpm dsh ...`。

插件装进 profile 后随 Web UI 启动自动加载，**无需手动启用**；Settings → Plugins 列表只显示有配置项的插件，本插件没有配置项，不会出现在那里。

### 方式一：本地源码安装（开发/自用）

```sh
git clone https://github.com/liuup/dsh-latex.git
cd dsh-latex
pnpm install && pnpm build          # 构建出 lib/（产物已被 gitignore，必须本地构建）
npx @deepseek-ai/dsh plugin --profile web add link:/absolute/path/to/dsh-latex
npx @deepseek-ai/dsh web            # 启动 Web UI
```

### 方式二：从 GitHub 直接安装（无需本地构建）

```sh
npx @deepseek-ai/dsh plugin --profile web add github:liuup/dsh-latex
```

git 安装拉取的是源码，pnpm 会自动执行包内的 `prepare` 脚本完成构建。pnpm ≥10 默认拒绝运行 git 依赖的 `prepare`，**首次 `add` 会失败**——`dsh` 会打印指引：按提示把对应条目加入 profile 的 `pnpm-workspace.yaml`（`allowBuilds` 段），然后重跑上面的命令。生产使用建议 pin 提交：`github:liuup/dsh-latex#<commit-sha>`。

### 方式三：npm 发布后（最省事）

```sh
# 维护者侧：发布
cd dsh-latex && pnpm build && npm publish

# 用户侧：直接按包名安装（无需任何额外配置）
npx @deepseek-ai/dsh plugin --profile web add dsh-latex-tools
```

### 验证安装

```sh
npx @deepseek-ai/dsh --profile web --dump-config   # 应看到 "# == dsh-latex-tools" 层
# 浏览器检查：
#   /plugins/dsh-latex-tools/client.js   —— browser half 的 bundle
#   /latex-tools/mathjax/es5/tex-svg.js  —— SVG 导出用的 MathJax（约 2.1 MB）
```

## 开发

```sh
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest（jsdom：工具条显隐 / 复制 / SVG 导出）
pnpm build       # tsdown：lib/index.js（host half）+ lib/client.js（browser half）
```