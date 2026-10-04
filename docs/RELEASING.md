# 打包与发布

更新：2026-10-04。仓库：[gbs00/markdown2cv](https://github.com/gbs00/markdown2cv)。当前版本为 [0.1.1](https://github.com/gbs00/markdown2cv/releases/tag/0.1.1)。已提交 Obsidian 社区目录审核，本次记录状态为 **Pending**，对应提交 `84b1e21`。目录条目仍为草稿，尚未公开；[审核后台](https://community.obsidian.md/account/plugins/markdown-to-cv)需要维护者登录。GitHub Release 与社区目录发布是两个独立步骤。

## 本次已调整

- 字体随 `main.js` 内嵌，市场安装的三个文件已经包含全部运行资源，不依赖旧 `fonts/` 目录、系统字体或首次联网下载。
- 字体首次预览才解码，并复用缓存；预览 DOM 不插入大段 base64。PDF 仍内嵌同一份原始字节。
- 源码使用 MIT，思源黑体保持 SIL OFL 1.1；两份完整许可和字体来源均保存在安装文件中。
- 作者设为 `gbs00`，最低 Obsidian 版本收敛为已测试的 `1.13.7`；桌面限制保留。
- 发布构建去除内联 sourcemap，校验版本、字体字节、许可及 ZIP；GitHub Actions 自动执行检查并保留产物，不自动发布。
- 接入官方 ESLint 推荐配置。两处针对文件的例外有明确说明：排版器保留显式 ownerDocument 的原生 DOM 创建；纯取消逻辑保留 Node 和浏览器共用的 globalThis 定时器。PDF 桥接的延迟 require 也保留了原因说明。

## 可重复构建

需要 Node.js 24、npm、Python 3。在仓库根目录运行：

```sh
npm ci
npm run check:release
```

产物目录：

```text
release/0.1.1/
  main.js
  manifest.json
  styles.css
  markdown-to-cv-0.1.1.zip
  SHA256SUMS.txt
```

ZIP 内只有 `markdown-to-cv/main.js`、`manifest.json`、`styles.css`。同一份文件同时用于手动安装和社区安装；不要使用 GitHub 自动生成的源码压缩包安装插件。

官方安装器只下载三个指定文件，因此不能仅上传 ZIP，也不能依赖单独的字体附件。[官方文件下载规则](https://github.com/obsidianmd/obsidian-releases#how-community-plugins-are-pulled)

## 发布验收

```sh
npm run prepare:release-test
# 把输出目录作为独立 Vault 打开，仅在此测试 Vault 启用 Markdown to CV
npm run test:release-host
```

脚本从待发布文件创建全新安装，校验目录与标记后才运行。检查字体按需加载、原始字节 hash、缓存复用、断网预览及真实 PDF、照片、缩放、卸载和重载。原始证据在 `evidence/release-0.1.1/`，PDF 在 `output/pdf/release-0.1.1/`，均不上传。

PDF 进一步用 Poppler 和 macOS PDFKit 检查逐页文字、搜索、链接、页数及字体内嵌，并渲染成图片检查布局。结果和剩余验收见 [0.1.1 发布验收](RELEASE-0.1.1.md)。

## 创建 GitHub Release

1. 确认代码已推送，CI 通过；`manifest.json`、`package.json`、`versions.json` 及产物版本一致。
2. 标签使用 **`0.1.1`**，不要加 `v`。将三个安装文件分别作为附件上传，可以额外附 ZIP 和校验清单。
3. 先创建草稿核对发布说明和资产，再决定公开仓库及发布 Release。公开前检查是否包含个人资料；本仓库忽略 Vault、截图、日志与导出文件。
4. 用最终 Release 附件再做一次下载、hash 和安装验证，避免上传错版本。

版本标签必须与根目录及资产 manifest 一致；社区安装依靠 Release 附件，而非源码目录中的构建文件。[官方提交指南](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 提交 Obsidian 社区目录

用 Obsidian 账号登录 [Obsidian Community](https://community.obsidian.md)，关联 GitHub，在 **Plugins → New plugin** 填写仓库地址、选择所有者，并确认开发者政策后提交。按当前官方说明使用此入口，不沿用向旧插件列表提 PR 的教程。[官方账号与提交说明](https://docs.obsidian.md/community-directory/set-up-and-claim)

目录会读取默认分支的 manifest 并审核。根据反馈修正，递增版本后发布新 Release；审核通过并完成发布后，用户才可以在应用内安装。[官方审核流程](https://docs.obsidian.md/plugins/releasing/submit-plugin)

后续更新通过 GitHub Release 提供，标签、根目录 manifest 和附件版本保持一致。兼容门槛变化时维护 `versions.json`。源码许可证和字体许可都应持续保留。[官方许可与披露要求](https://docs.obsidian.md/community-directory/developer-policies)

## 仍需验证的范围

- Windows/Linux 未验收；Android/iOS 明确不支持。
- 真正的中文输入法组字、常见第三方主题、长时间稳定性与真实用户任务仍需人工/扩展验收。
- PDF 依赖宿主非公共 `@electron/remote` 桥接，应在每次升级 Obsidian 后复核；HTML 预览保留清晰的失败处理。
- 不能把打包、静态检查和开发样例测试等同于社区已审核或所有用户体验均已验收。
