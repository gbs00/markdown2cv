# Markdown to CV · Obsidian 开发版

在 Obsidian 原生编辑器中写 Markdown，右侧查看 A4 分页简历，点击时导出可搜索、可复制的 PDF。现为 **0.1.0 开发版**，主要在 macOS 上验证，尚未发布到社区插件市场。

源码仓库：[gbs00/markdown2cv](https://github.com/gbs00/markdown2cv)。打包、手动安装及社区市场发布准备见 [发布指南](docs/RELEASING.md)。仓库名为 `markdown2cv`，插件 ID 保持 `markdown-to-cv`。

## 本机运行

```sh
git clone https://github.com/gbs00/markdown2cv.git
cd markdown2cv
npm ci
npm run check
npm run deploy:dev
obsidian vault='dev-vault' plugin:reload id=markdown-to-cv
obsidian vault='dev-vault' open path=fixtures/01-standard.md
obsidian vault='dev-vault' command id=markdown-to-cv:open-preview
```

首次运行时，用 Obsidian 的“管理仓库 → 打开本地仓库”选择项目下 `dev-vault`，在该仓库启用 Markdown to CV。部署脚本只允许此固定目录，拒绝符号链接，没有主 Vault 安装参数。运行状态、试写笔记和 `.obsidian` 配置均被 Git 忽略；源 fixture 在 `fixtures/` 下单独版本管理，重复部署不会覆盖已编辑的 fixture 副本。

需要 Node.js、npm；当前开发环境为 Node.js 24。上述 `obsidian` 命令还需要已启用的 Obsidian CLI，也可在应用中手动打开样例和调用命令。私有仓库的克隆需要账号访问权限。

## 手动安装包

```sh
npm ci
npm run package:manual
```

需要 Python 3。生成 `release/markdown-to-cv-0.1.0-manual.zip`，包含完整的 `markdown-to-cv/` 插件目录、思源黑体及其许可，可解压到测试 Vault 的 `.obsidian/plugins/` 下。该 ZIP 用于手动测试安装；当前独立 `fonts/` 的资源方式还不适用于社区市场的三文件安装流程，详见 [发布前差距](docs/RELEASING.md#当前发布前差距)。

插件在本地读取当前笔记和引用的附件，并将 PDF 写入用户在保存对话框中选择的位置（可以在 Vault 外）。不主动上传简历，不要求账号或联网；当前版本仅支持桌面端。

入口：左键点击侧栏简历图标新建简历；右键图标依次选择“新建简历”“预览简历”“导出简历”。预览和导出针对当前 Markdown 笔记，在简历预览中则针对其源笔记；没有可用笔记时两项置灰。导出可直接使用，无须先手动打开预览，并固定点击时的内容（含未保存改动）。命令面板和文件右键“打开简历预览”仍可使用。预览跟随当前 Markdown 笔记，下方显示完整来源路径。预览工具栏常驻“新建简历”“回到模板”“导出 PDF”，导出期间显示“取消导出”。诊断提示仍可定位到源笔记的对应行。快捷键不预占，用户自行绑定。

工具栏以强调色突出“导出 PDF”，三项操作均有图标与文字。预览默认适应宽度，可通过加减按钮或比例下拉框选择 50%、75%、100%、125%、150%、200%；放大后横向、纵向滚动查看局部，“适应宽度”可一键返回全宽视图。继续编辑时保留当前比例与浏览位置，缩放设置随视图状态保存。缩放只影响右侧显示，PDF 仍按原 A4 字号与分页导出。

## 可选照片

新模板在姓名下方提供空的 `**照片：**` 字段。将 PNG、JPEG 或 WebP 照片保存为 Vault 附件，再填入引用；也可把图片拖到该字段后或下一独立段落：

```md
# 你的姓名

**照片：** ![[附件/头像.jpg]]

**求职方向：** 产品工程师
```

也支持标准 Markdown 图片 `![照片](<附件/头像 (1).jpg>)`。只识别首个姓名一级标题之后、下一个标题之前的照片字段；其他章节和正文图片仍按原位置展示。基础信息只支持一张照片，文字居左、图片居右，顶部对齐；最大 28 × 36 mm，等比缩放，不裁切、不拉伸。图片引用中的尺寸设置不改变简历的照片布局。

留空或删去字段时无照片占位。附件缺失、损坏、重复照片或远程网址会给出可定位提示，正文继续预览；修正或清空字段后才能导出。PDF 内嵌照片，不依赖原附件路径。已有笔记不会被模板升级自动改写，可自行在姓名下方添加同一字段。

## 验证入口

```sh
npm run typecheck  # 公共 API/TypeScript 类型
npm test          # 内容保护、修复、版本竞争与原子文件写入
npm run test:host # 真实 Obsidian；必须已打开 dev-vault 并启用插件
npm run test:pdf  # 使用可用的 Python；需 pypdf + pdfplumber
npm run test:font # 当前字体的安全后台检查；需 Poppler、Python pypdf、macOS PDFKit/Swift
npm run test:photo # 后台照片布局/失败降级/实际 PDF；只使用临时虚构附件
python3 scripts/check-photo-pdf.py # 核对照片 PDF 并渲染视觉检查 PNG；需 Poppler
npm run test:lifecycle # 仅 dev-vault 的 3 轮启停检查
npm run test:preview-ui # 预览工具栏、缩放和 PDF 尺寸检查
```

`test:host` 创建/修改的内容仅在 `dev-vault/qa-runtime` 与测试笔记副本中；会生成 `output/pdf` 下的真实测试 PDF，测试结果写入 `evidence/host-results.json`。它校验 Vault 绝对路径及标记文件，拒绝对其他 Vault 运行。宿主 CLI 中仅测试 harness 通过插件管理器取得测试实例，产品接入使用公共 TypeScript API。

当前覆盖和未测项目见 [验收矩阵](docs/ACCEPTANCE.md) 与 [开发记录](docs/DEVELOPMENT.md)。不要把构建成功或单元测试通过理解为所有用户体验已验收。

宿主测试中的部分隔离校验仍固定原开发机路径，换机器运行前需调整并核对目标 Vault。`evidence/` 和 `output/` 是本地生成的验收产物，不随源码上传；文档中的历史证据链接需在原环境查看或重新执行对应检查。

用户已在 `dev-vault` 填写内容时，用 `npm run deploy:dev -- --plugin-only` 只更新插件。`test:font` 使用仓库虚构文本、不可见测量节点和独立隐藏 PDF 窗口，不创建笔记、不操作编辑器或标签焦点，输出到唯一的 `output/pdf/source-han-*` 目录。完整 `test:host` 会切换自己的测试标签，不适合在用户正在使用 Vault 时运行。已有预览的重载应保留原生缓冲区及当前标签；不要为了验收打开用户已关闭的预览。

## 边界与开发决策

- 实测环境：macOS 27.0、Obsidian 1.13.7（installer 1.12.4）、Electron 39.7.0。manifest 1.13.0 是保守开发门槛，旧版和其他系统尚未验证。
- HTML 使用 `ItemView`、`MarkdownRenderer.render` 与原生编辑缓冲区；没有第二个编辑器、通用 Markdown 库或 Chromium 安装。
- 一套 A4 / 16 mm 页边距样式，Shadow DOM 隔离。列表按项跨页，超长段落按 DOM Range 拆分并保留链接、文字顺序；复杂超长表格或不可分内容会报错，避免裁切后假报成功。
- 默认内置 Adobe **思源黑体 CN 2.005R** 官方可变 WOFF2，7,711,988 字节（7.71 MB），离线可用，无须安装系统字体。正文 400、章节与公司/项目名 500、姓名和显式加粗 700；Markdown 斜体保留。字体原文件、来源、校验值与 OFL 许可位于 [assets/fonts](assets/fonts/SOURCE.md)，构建和部署均携带它们。
- 预览缓存字体字节和每个文档的 FontFace，正常编辑不重新读字体、不把大段字体数据塞入预览 DOM。PDF 内嵌同一文件并明确等待需要的字重加载成功；资源缺失会报错，不会用系统字体冒充加载成功。官方 CN 字库覆盖 30,926 个码点，并非所有 Unicode/罕见姓名用字；例如 `𠮷` 不在该资源中。
- 当前宿主 PDF 以 Type3 字形程序内嵌字体，`/ActualText` 保存原文。Poppler 和 macOS PDFKit 的复制/查找及逐页比较已验证；部分不读取 ActualText 的提取器（包括本机 pypdf 文本提取）会把同形汉字误读为部首。未做 Unicode 归一化或 CMap 重写，也不承诺所有 ATS/提取器兼容。
- PDF 兼容层在 `src/pdf.ts`，使用当前宿主已有的 `@electron/remote` 和隐藏 BrowserWindow。**这不是 Obsidian 公共稳定 PDF API**；运行时检测，接口不可用则报错。隐藏窗口没有 Node 权限，不访问网络，禁用导航；仅装入已渲染静态内容，完成后复用，插件停用时销毁。
- 点击时固定完整版本，等待字体/图片/分页后生成，原子写入实际 PDF 才报告成功。自动化计时从调用导出操作到写入完成；指定测试路径跳过人工选择路径时间。
- “回到模板”生成原文快照与修复副本，不覆盖源笔记。仅补明确的标题空格或已知字段加粗标记；不推测文本归属，不补默认模块。歧义文字保留原位并附待整理说明。这是开发版可逆选择，仍待用户体验确认。
- 标准标题、段落、列表、强调、链接先行。本地图片需要加载成功；远程图片导出明确报错。第三方动态插件输出、复杂嵌入和任意 HTML 不在本版完整兼容承诺内。
- 无账号、同步服务、AI 润色、模板市场或密度档位。

## 文件说明

- `src/`：插件、原始模板、共享纸张样式与兼容层。
- `assets/fonts/`：唯一分发字体、官方 OFL 许可和来源记录。
- `fixtures/`：六类虚构样例，另含超长段落、全空笔记变体。
- `docs/PREPARATION.md`：环境检查与官方依据。
- `docs/cases.json`、`docs/ACCEPTANCE.md`：CV-01 到 CV-26 状态、步骤、证据。
- `docs/RELEASING.md`：手动打包及社区市场发布指南。
- `evidence/`：本地宿主结果、检查日志、截图与 PDF 文本对照，不入库。
- `output/pdf/`：本地导出的 PDF 样例，不入库。
- `release/`：手动安装 ZIP 与校验值，不入库。
- `dist/`：构建产物；`dev-vault/`：隔离运行环境，均可重新生成。
