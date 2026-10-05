# 打包与发布

更新：2026-10-05。仓库：[gbs00/markdown2cv](https://github.com/gbs00/markdown2cv)。当前准备发布 **0.1.2**，安装包、CI 来源证明与公开下载校验的最终结果见 [0.1.2 发布验收](RELEASE-0.1.2.md)。历史 [0.1.1 Release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.1) 保持不变。

0.1.1 已提交社区目录，2026-10-04 的后台结果为 **Completed**，包含警告与建议；Completed 表示自动检查完成，不代表所有警告已解决。0.1.2 尚待发布后触发新版本检查。可在[审核后台](https://community.obsidian.md/account/plugins/markdown-to-cv)查看维护者记录，在[公开条目](https://community.obsidian.md/plugins/markdown-to-cv)查看目录信息。GitHub Release、目录可见性和应用内安装状态分别核对。

## 本次调整

- 减少相同内容的重复渲染、编辑器读取、分页扫描和字体/图片重复编码；改进取消、卸载和弹出窗口的资源清理。详见[架构记录](ARCHITECTURE.md)。
- 默认构建与发布构建使用相同生产参数，不包含内联 sourcemap；调试映射仅在显式开发模式使用。
- 补充英文功能说明、安装步骤、使用流程、数据访问及兼容边界。
- CI 在推送到 `main` 时为三个安装文件生成 GitHub artifact attestations。发布时使用并验证该次 CI 产物；CI 不会自动创建 Release 或发布社区条目。
- 字体继续随 `main.js` 内嵌，三个安装文件包含全部运行资源。首次预览解码并缓存，导出复用同一份原始字节。
- 源码采用 MIT；思源黑体保持 SIL OFL 1.1。两份完整许可和字体来源保存在安装文件中。
- 最低 Obsidian 版本保持 `1.13.7`，保留桌面限制。本地 ESLint 对显式 ownerDocument 的排版 DOM 创建保留说明性例外；PDF 桥接延迟 require 也保留原因说明。

## 可重复构建

需要 Node.js 24、npm、Python 3。在仓库根目录运行：

```sh
npm ci
npm run check:release
```

此命令执行 ESLint、30 项自动测试、TypeScript、生产构建、版本/字体/许可及安装包校验。`npm run build` 与 `npm run build:release` 产物一致；`npm run dev` 才启用调试映射与监听。

产物目录：

```text
release/0.1.2/
  main.js
  manifest.json
  styles.css
  markdown-to-cv-0.1.2.zip
  SHA256SUMS.txt
```

ZIP 内只有 `markdown-to-cv/main.js`、`manifest.json`、`styles.css`。同一份文件同时用于手动安装和社区安装；不要使用 GitHub 自动生成的源码压缩包安装插件。

官方安装器只下载三个指定文件，因此不能仅上传 ZIP，也不能依赖单独的字体附件。ZIP 和 SHA256SUMS 是供手动安装使用的附加文件，社区安装器会忽略它们。[官方文件下载规则](https://github.com/obsidianmd/obsidian-releases#how-community-plugins-are-pulled)

## 发布验收

```sh
npm run prepare:release-test
# 把输出目录作为独立 Vault 打开，仅在此测试 Vault 启用 Markdown to CV
npm run test:release-host
```

脚本从待发布文件创建全新安装，校验目录与标记后才运行。检查字体按需加载、原始字节 hash、缓存复用、断网预览及真实 PDF、照片、缩放、卸载和重载。PDF 进一步用 Poppler 和 macOS PDFKit 检查逐页文字、搜索、链接、页数及字体内嵌，并渲染成图片检查布局。

原始证据、测试 Vault、PDF、截图及真实笔记不上传仓库。0.1.2 的最终核对与本轮架构回归证据分别记录，避免把旧版本元数据的测试误写为新版安装结果。参见 [0.1.2 发布验收](RELEASE-0.1.2.md)；历史结果见 [0.1.1 发布验收](RELEASE-0.1.1.md)。

## 创建 GitHub Release

1. 确认 `manifest.json`、`package.json`、`versions.json` 及产物版本一致，代码已推送且该提交的 CI 通过。
2. 下载该次 CI 安装产物，与本地验证产物逐字节核对；核验三个文件的 GitHub 来源证明。
3. 标签使用 **`0.1.2`**，不要加 `v`，指向该次 CI 对应提交。把三个安装文件分别作为附件上传，可以额外附 ZIP 和校验清单。
4. 按授权创建并发布 Release。公开前核对说明、资产、许可证和忽略规则，不包含真实简历及本地验收数据。
5. 重新下载最终公开附件，比较 hash、版本和三个安装文件，防止上传错版本。记录 CI、标签、Release 与来源证明的验证结果。

版本标签必须与根目录及资产 manifest 一致；社区安装依靠 Release 附件，而非源码目录中的构建文件。[官方提交指南](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 更新 Obsidian 社区目录

本插件已有条目，后续发布无需新建重复条目。在[审核后台](https://community.obsidian.md/account/plugins/markdown-to-cv)使用 **Check for new releases** 检查新版本，并查看该版本的实际审核结果。不要把旧版 Completed 状态当作新版审核结果。

新插件首次提交时，用 Obsidian 账号登录 [Obsidian Community](https://community.obsidian.md)，关联 GitHub，在 **Plugins → New plugin** 填写仓库地址、选择所有者，并确认开发者政策。按当前官方说明使用此入口，不沿用向旧插件列表提 PR 的教程。[官方账号与提交说明](https://docs.obsidian.md/community-directory/set-up-and-claim)

后续更新通过 GitHub Release 提供，标签、根目录 manifest 和附件版本保持一致。兼容门槛变化时维护 `versions.json`；源码许可证和字体许可持续保留。[官方许可与披露要求](https://docs.obsidian.md/community-directory/developer-policies)

## 已知约束与剩余范围

- 完整思源黑体使 `main.js` 超过 5 MB，超出 Obsidian Sync Standard 的单文件限制。0.1.2 未缩减字库，此审核警告仍需如实保留。
- 导出使用 Node.js 文件系统将 PDF 原子写入用户选择的位置，包括 Vault 外目录；这是导出所需能力，不改成未经用户选择的后台写入。
- PDF 依赖宿主非公共 `@electron/remote` 桥接，应在每次升级 Obsidian 后复核；桥接失效时保留 HTML 预览并提示无法导出。
- Windows/Linux 未验收；Android/iOS 明确不支持。真实中文输入法组字、常见第三方主题、长时间稳定性与真实用户任务仍需补充验收。
- 本地规则例外、CSS 规范和社区重构建等警告应结合新版本报告核对，不能把功能回归通过等同于所有审核警告已清除。
