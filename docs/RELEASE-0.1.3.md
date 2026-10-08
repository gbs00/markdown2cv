# 0.1.3 发布验收

日期：2026-10-08。此版本修复新建简历位置：显式右键目标优先，其次最近操作的原生文件列表／Notebook Navigator 文件夹，再使用当前笔记（预览页使用源笔记）目录，无上下文时使用 Vault 根目录。切换笔记清除旧导航选择，同名文件继续自动编号。模板、字体、排版和 PDF 导出逻辑保持。

## 目录行为回归

- 7 项新增逻辑测试覆盖目录优先级、根目录、无效选择、导航 API 不可用、关闭／切换笔记等情况；既有 30 项测试保持通过。
- macOS / Obsidian 1.14.4 / Notebook Navigator 3.4.3 隔离 Vault 的 8 项宿主检查通过，包含当前笔记目录、预览源目录和重名、原生文件列表、文件夹右键、Notebook Navigator、切换笔记和原笔记全文不变。
- 原生鼠标操作独立验证：文件列表选中文件夹后从预览新建、Notebook Navigator 选中文件夹后从侧栏图标新建，均落在所选文件夹。
- 本机日常 Vault 仅更新插件，未创建验收笔记；编辑器对象、未保存文本和活动标签保持。

目录行为证据位于本地 `evidence/resume-location-20261008/`，包括 `host-results.json`、`native-ui.json` 和 `local-install.json`，不入库。该轮构建仍使用 0.1.2 版本元数据；下面单独记录 0.1.3 安装产物核对。

## 最终发布核对

- 已通过：`npm run check:release`，包含 ESLint、37 项测试、TypeScript、生产构建、版本／字体／许可及 ZIP 完整性检查。
- 已通过：0.1.3 三文件安装在 macOS / Obsidian 1.14.4 隔离 Vault 的 9 项宿主检查，包含首次预览延迟加载字体、单次解码与缓存、断网预览／照片／真实 PDF、150% 缩放不改分页、卸载和重载。标准、长简历、照片简历分别为 1、2、1 页。
- 已通过：三份 PDF 的 Poppler 与 macOS PDFKit 检查；逐页文字码点、搜索与选择、链接、字体／照片内嵌、A4 尺寸与预览页数一致。未把此轮元数据／文本核对表述为新增人工视觉验收。
- 已通过：[GitHub CI](https://github.com/gbs00/markdown2cv/actions/runs/37799296693) 对提交 `e1bb1012e5a873a602af43454df12f8a57aef903` 构建成功。三个本地安装文件的 `gh attestation verify` 均成功，限定 `gbs00/markdown2cv`、`check.yml`、该提交 source digest 及 GitHub 托管 runner，确认文件哈希对应这次 CI 构建。
- 已发布：[0.1.3 GitHub Release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.3) 于 2026-10-08 23:25:28（Asia/Shanghai）成为最新正式版，非草稿、非预发布；标签指向上述 CI 提交。三个安装文件、手动 ZIP 及 SHA256SUMS 共五个附件，上传后的服务端 digest 和匿名公开下载均与本地已验收文件一致，ZIP 内三文件也逐字节一致。
- 已触发社区新版本检查：后台识别 0.1.3（`e1bb101`）并显示 **Pending**，Current release 仍为 0.1.2；此记录不表示 0.1.3 社区检查完成或应用内更新已经可用。
- 本机插件已更新并重载为 0.1.3，编辑器对象、未保存文本和活动标签均保持；没有在日常 Vault 创建验收笔记。

本次 CI artifact 压缩包下载发生连接中断（`IncompleteRead`），未将其记为下载核对通过。实际上传使用上述已通过 CI 来源证明的本地副本；三个安装文件对应经 CI 签名的相同 SHA-256，最终公开附件又完成独立下载核对。来源证明、上传 digest 和公开附件记录分别见本地证据目录中的 `attestation-main.json`、`attestation-manifest.json`、`attestation-styles.json`、`upload-check.json` 和 `public-download-check.json`。社区状态保存在 `community-review.txt`／`community-review.png`，本机更新记录为 `local-install.json`。

最终版本宿主和 PDF 证据位于本地 `evidence/release-0.1.3/host-results.json`、`pdf-results.json`、`pdfkit-results.json`，不入库。

## 安装和升级

[0.1.3 Release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.3) 提供 `main.js`、`manifest.json`、`styles.css` 及手动安装 ZIP。停用插件后替换 `.obsidian/plugins/markdown-to-cv/` 内的三个文件，再启用即可。简历 Markdown 无需迁移。

## 支持边界

- 最低 Obsidian 版本保持 1.13.7；本轮目录验收使用 macOS / Obsidian 1.14.4。Windows/Linux 未验收，Android/iOS 不支持。
- Notebook Navigator 使用可选公共 API；核心文件列表尚无公开选择 API，适配层守卫读取私有选择状态，失效时回退当前笔记目录。宿主升级后需继续回归。
- 完整思源黑体继续内嵌，`main.js` 超过 5 MB；Obsidian Sync Standard 的单文件限制仍在。
- PDF 仍依赖非公共 `@electron/remote`。已有字体、提取器、主题和长时间体验等限制见 README；本次发布不代表社区所有警告均已消除。
