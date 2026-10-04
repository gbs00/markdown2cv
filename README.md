# Markdown to CV

在 Obsidian 原生编辑器中写 Markdown，右侧即时预览 A4 简历，并导出本地 PDF。面向习惯 Markdown、希望自由组织内容且少调整格式的用户。

当前版本：**0.1.1 发布候选版**。已实现桌面端功能；macOS / Obsidian 1.13.7 为验收环境。社区市场尚未上架。

## 使用方式

1. 点击侧栏简历图标，新建包含基础信息、工作经历、项目经历、教育经历和技能的模板。
2. 在 Obsidian 原生编辑器中修改内容。章节可以改名、增删和重排。
3. 右键侧栏图标可选择“新建简历”“预览简历”“导出简历”；也可从命令面板调用。没有可用 Markdown 笔记时，预览和导出置灰。
4. 预览跟随当前 Markdown 笔记。使用加减按钮或比例下拉框放大到 50%、75%、100%、125%、150%、200%，滚动查看局部；点击“适应宽度”恢复。缩放不会改变 PDF 字号或分页。
5. 点击“导出 PDF”选择保存位置。导出固定点击时的内容，包括尚未落盘的编辑；期间仍可继续写作，也可取消导出。

工具栏以强调色突出“导出 PDF”，不反复显示“已更新”或耗时秒数。快捷键不预占，可在 Obsidian 设置中自行绑定。

“回到模板”会保存点击时的原文快照，并另建修复副本，原笔记不被覆盖。只修复能确定的标题空格、字段加粗标记等损坏；不猜测内容归属，不补回用户删除的章节。

## 安装与更新

尚未上架社区市场。测试安装包通过 GitHub Release 附件分发；正式发布前，草稿只供具有仓库写入权限的协作者检查。

将以下三个文件放入 Vault 的 `.obsidian/plugins/markdown-to-cv/`，然后在 Obsidian 的社区插件设置中启用插件：

- `main.js`
- `manifest.json`
- `styles.css`

也可以解压 Release 附件 `markdown-to-cv-0.1.1.zip`，把其中的完整 `markdown-to-cv` 目录放到 `.obsidian/plugins/`。GitHub 自动生成的 Source code ZIP 不是插件安装包。

从 0.1.0 更新时替换上述三个文件并重新加载插件即可。0.1.1 不再读取旧的 `fonts/` 目录；无需安装系统字体或下载额外字体。最低 Obsidian 版本为 **1.13.7**。

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

上述命令执行官方 Obsidian ESLint 规则检查、18 项逻辑测试、类型检查、发布构建和产物校验。生成 `release/0.1.1/`：三个安装文件、手动安装 ZIP 和 `SHA256SUMS.txt`。许可证及字体来源同时保留在仓库与安装后的 `main.js` 中。

`npm run package` 单独构建安装包；`npm run package:manual` 为同一命令的兼容别名。GitHub Actions 对每次推送执行发布检查并保存构建产物，不会自动上架或发布 Release。

本地开发：

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
- [版本变更](CHANGELOG.md)
- [验收矩阵](docs/ACCEPTANCE.md)与[历史开发记录](docs/DEVELOPMENT.md)
- [思源黑体来源、校验值和许可](assets/fonts/SOURCE.md)

源码采用 [MIT](LICENSE)；字体独立采用 [SIL OFL 1.1](assets/fonts/LICENSE.txt)，版权归 Adobe。OFL 不被 MIT 替代。

测试 Vault、真实简历、截图、导出的 PDF、临时文件和本地验收原始证据不入库；历史文档中的本地证据链接需要在原环境查看或重新生成。
