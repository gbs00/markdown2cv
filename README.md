# Markdown to CV

## Description

Create resumes in Obsidian's native Markdown editor with a live A4 HTML preview and local PDF export. Organize sections freely, use a starter template, add an optional local photo, and zoom the preview without changing the exported layout. The plugin includes Source Han Sans CN for offline Chinese and English typography. The interface and starter template currently use Chinese.

**Version: 0.1.2. Requires Obsidian 1.13.7 or later on desktop.** Tested on macOS; Windows and Linux have not been validated. Android and iOS are not supported.

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [GitHub release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.2).
2. Put all three files in `<your-vault>/.obsidian/plugins/markdown-to-cv/`.
3. Open **Settings → Community plugins** in Obsidian and enable **Markdown to CV**. To update a manual installation, disable the plugin, replace those three files, and enable it again.

Alternatively, extract `markdown-to-cv-0.1.2.zip` into `.obsidian/plugins/`. GitHub's automatically generated source archives are not installable plugin packages. Community-directory review and GitHub releases are separate; see the [release status](docs/RELEASING.md).

## Usage

1. Click the resume ribbon icon to create a resume (`新建简历`), then edit the generated Markdown in Obsidian.
2. Right-click the ribbon icon and choose **Preview resume** (`预览简历`) to preview the active Markdown note. The same commands are available in the command palette.
3. Add, rename, or reorder sections. The preview updates as you edit; use **Fit width** (`适应宽度`) or 50–200% zoom to inspect it.
4. Choose **Export PDF** (`导出 PDF`) and select a local destination. Export captures the content at the moment you click, including unsaved edits. You can keep editing or cancel the export.
5. **Return to template** (`回到模板`) preserves an original snapshot and creates a repaired copy; it does not overwrite the source note.

No account, telemetry, or cloud service is required. Notes and attachments stay local; ordinary remote Markdown images may be fetched by Obsidian, while resume photos and PDF images must be local. PDF export writes to the destination you choose, including paths outside the vault, and uses the host's non-public `@electron/remote` bridge. A host update may affect this bridge; HTML preview remains available if export fails. The bundled full font makes `main.js` larger than 5 MB, exceeding the Obsidian Sync Standard per-file limit. Source code is MIT-licensed; the bundled font retains its SIL OFL license.

## 中文说明

在 Obsidian 原生编辑器中写 Markdown，右侧即时预览 A4 简历，并导出本地 PDF。面向习惯 Markdown、希望自由组织内容且少调整格式的用户。

当前版本：**0.1.2**。已实现桌面端功能；macOS / Obsidian 1.13.7 为验收环境。GitHub 发布与社区目录审核状态见[发布记录](docs/RELEASING.md)。

## 使用方式

1. 点击侧栏简历图标，新建包含基础信息、工作经历、项目经历、教育经历和技能的模板。
2. 在 Obsidian 原生编辑器中修改内容。章节可以改名、增删和重排。
3. 右键侧栏图标可选择“新建简历”“预览简历”“导出简历”；也可从命令面板调用。没有可用 Markdown 笔记时，预览和导出置灰。
4. 预览跟随当前 Markdown 笔记。使用加减按钮或比例下拉框放大到 50%、75%、100%、125%、150%、200%，滚动查看局部；点击“适应宽度”恢复。缩放不会改变 PDF 字号或分页。
5. 点击“导出 PDF”选择保存位置。导出固定点击时的内容，包括尚未落盘的编辑；期间仍可继续写作，也可取消导出。

工具栏以强调色突出“导出 PDF”，不反复显示“已更新”或耗时秒数。快捷键不预占，可在 Obsidian 设置中自行绑定。

“回到模板”会保存点击时的原文快照，并另建修复副本，原笔记不被覆盖。只修复能确定的标题空格、字段加粗标记等损坏；不猜测内容归属，不补回用户删除的章节。

## 安装与更新

手动安装请从 [0.1.2 GitHub Release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.2) 下载附件。

将以下三个文件放入 Vault 的 `.obsidian/plugins/markdown-to-cv/`，然后在 Obsidian 的社区插件设置中启用插件：

- `main.js`
- `manifest.json`
- `styles.css`

也可以解压 Release 附件 `markdown-to-cv-0.1.2.zip`，把其中的完整 `markdown-to-cv` 目录放到 `.obsidian/plugins/`。GitHub 自动生成的 Source code ZIP 不是插件安装包。

从旧版更新时，先停用插件，替换上述三个文件后再启用即可。自 0.1.1 起不再读取旧的 `fonts/` 目录；无需安装系统字体或下载额外字体。最低 Obsidian 版本为 **1.13.7**。

## 可选照片

将 PNG、JPEG 或 WebP 图片保存为 Vault 附件，在姓名一级标题下方填写：

```md
# 你的姓名

**照片：** ![[附件/头像.jpg]]

**求职方向：** 产品工程师
```

也支持标准 Markdown 图片 `![照片](<附件/头像 (1).jpg>)`，或在照片字段后的独立段落插入图片。基础信息只支持一张照片，文字居左、图片居右，顶部对齐，最大 28 × 36 mm，等比缩放且不裁切。

留空不占位。附件缺失、损坏、重复照片或远程照片网址会给出定位提示，正文继续预览；修正或清空字段后才能导出。PDF 内嵌照片。其他章节中的普通图片保持原位置。

## 字体与 PDF

内置 Adobe **思源黑体 CN 2.005R**，正文使用 400、章节和条目标题使用 500、姓名和加粗使用 700。字体原文件约 7.71 MB，在 `main.js` 内嵌，首次预览时解码并缓存，后续编辑复用。

完整字库使 `main.js` 超过 5 MB，不能通过 Obsidian Sync Standard 同步该文件；0.1.2 保留字库覆盖范围，未缩减此体积。

预览和 PDF 使用同一字体、纸张样式与分页结果。官方 CN 字库不是所有 Unicode 字符的全集，极少见姓名用字可能缺字。当前宿主的 PDF 字体使用 Type3 字形及 `ActualText`：Poppler、macOS PDFKit 的文字选择、搜索和逐页内容一致性可验证；忽略 `ActualText` 的部分提取器可能误读同形汉字，不承诺所有 ATS 兼容。

## 数据与网络

- 不要求账号、订阅或云服务，不采集遥测，也不上传简历。
- 核心编辑、预览、字体、照片与 PDF 流程可离线使用。
- 读取当前笔记和引用的 Vault 附件。PDF 写入用户在保存对话框中选择的位置，该位置可以位于 Vault 外。
- 普通正文若嵌入远程图片，Obsidian 的 Markdown 渲染可能请求对应网址；照片字段只接受本地附件，PDF 导出不接受远程图片。普通链接只有点击时才交给浏览器打开。

## 支持边界

- 桌面插件：使用 Node.js/Electron，Android 和 iOS 不支持。macOS 已测，Windows/Linux 尚未验收。
- PDF 使用宿主提供的 `@electron/remote` 兼容桥接，这不是 Obsidian 公共稳定 API；不可用时提示导出失败，HTML 预览仍可使用。
- 支持标准标题、段落、列表、强调、链接和本地图片。第三方动态插件输出、复杂嵌入和任意 HTML 不在完整兼容范围内。
- 无法无损分页的超高表格或不可分内容会明确报错。真实中文输入法、常见第三方主题、30 分钟稳定性和真实用户任务仍需补充验收。

## 开发与打包

需要 Node.js 24、npm；打包另需 Python 3。

```sh
git clone https://github.com/gbs00/markdown2cv.git
cd markdown2cv
npm ci
npm run check:release
```

上述命令执行 Obsidian ESLint 规则检查、自动测试、类型检查、发布构建和产物校验。生成 `release/0.1.2/`：三个安装文件、手动安装 ZIP 和 `SHA256SUMS.txt`。许可证及字体来源同时保留在仓库与安装后的 `main.js` 中。

`npm run package` 单独构建安装包；`npm run package:manual` 为同一命令的兼容别名。GitHub Actions 对每次推送执行发布检查并保存构建产物；推送到 `main` 时还为三个安装文件生成来源证明。正式发布使用核验后的 CI 产物，不会自动上架或发布 Release。

本地开发：

`npm run build` 与 `npm run build:release` 使用相同的生产参数；需要调试映射和监听更新时使用 `npm run dev`。监听模式同时更新独立的 `styles.css` 与 `manifest.json`。

```sh
npm run build
npm run deploy:dev
```

用 Obsidian 打开本项目下的 `dev-vault`，启用插件并使用 `fixtures/` 的虚构样例。已有试写内容时用 `npm run deploy:dev -- --plugin-only`，只更新插件。不要在使用中的 Vault 运行会切换笔记的全量宿主测试。

全新发布验收：

```sh
npm run prepare:release-test
# 在 Obsidian 中打开命令输出的独立 Vault，启用此插件
npm run test:release-host
```

此流程校验三个发布文件、首次预览延迟加载字体、断网字体/照片/导出、缩放、卸载与重载。目标 Vault 受路径和标记文件校验；只包含虚构样例。旧宿主测试脚本仍有原开发机路径约束，迁移时需调整隔离检查。

## 文档与许可

- [发布步骤与当前状态](docs/RELEASING.md)
- [0.1.2 发布验收](docs/RELEASE-0.1.2.md)
- [架构、资源生命周期与性能验证](docs/ARCHITECTURE.md)
- [版本变更](CHANGELOG.md)
- [验收矩阵](docs/ACCEPTANCE.md)与[历史开发记录](docs/DEVELOPMENT.md)
- [思源黑体来源、校验值和许可](assets/fonts/SOURCE.md)

源码采用 [MIT](LICENSE)；字体独立采用 [SIL OFL 1.1](assets/fonts/LICENSE.txt)，版权归 Adobe。OFL 不被 MIT 替代。

测试 Vault、真实简历、截图、导出的 PDF、临时文件和本地验收原始证据不入库；历史文档中的本地证据链接需要在原环境查看或重新生成。
