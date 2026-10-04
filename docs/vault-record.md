---
title: Markdown to CV 开发与验收记录
date: 2026-10-03
status: 开发版待体验验收
---

# 当前进度

依据 [[Markdown2CV PRD]]、[[功能清单]] 与 [[简历模板]]，首个可运行插件开发版 **0.1.0** 已完成。25 项均有开发实现；22 项在固定样例中通过技术验证，CV-03、CV-09、CV-12 部分通过，仍有明确待测内容。原需求文档与模板保持原样，未自动勾选原规划。

源码：`/Users/gbs00/Projects/markdown-to-cv`。

隔离测试 Vault：`/Users/gbs00/Projects/markdown-to-cv/dev-vault`。插件只安装在此，主 Obsidian Vault 未安装或启用本插件。

- [源码与运行说明](file:///Users/gbs00/Projects/markdown-to-cv/README.md)
- [25 项验收矩阵](file:///Users/gbs00/Projects/markdown-to-cv/docs/ACCEPTANCE.md)
- [完整开发记录与限制](file:///Users/gbs00/Projects/markdown-to-cv/docs/DEVELOPMENT.md)
- [打开隔离测试样例](obsidian://open?vault=dev-vault&file=fixtures%2F01-standard.md)

# 已实现与实测

已实现原生编辑与已有笔记接入、五模块模板、自由章节、空字段收起、最新缓冲区与版本保护、HTML A4 分页、点击版本 PDF、取消/错误重试、保守修复副本以及移动/重命名/重开/启停清理。

构建和类型检查通过，**11 个逻辑测试、21 项真实宿主检查、3 轮启停检查通过**。原生中文粘贴、撤销重做、保存对话框取消已验证。PDF 逐页文字/顺序、外链和页面图像检查通过。

- [标准简历 PDF · 1 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/standard.pdf)
- [中文/链接/分页 PDF · 2 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/two-page.pdf)
- [超长段落 PDF · 2 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/long-paragraph.pdf)

本轮一页程序化编辑到预览 P95 为 **105.5 ms**（12 次样本）；首个 PDF 导出 **0.485 秒**，后续两份 **0.369 / 0.326 秒**。计时覆盖处理、资源等待、布局、生成及写入，预先指定测试路径，未包含人工选择路径时间。这只是一次实测基线，不是已批准性能标准。

# 使用与复测

```sh
cd /Users/gbs00/Projects/markdown-to-cv
npm ci
npm run check
npm run deploy:dev
obsidian vault='dev-vault' plugin:reload id=markdown-to-cv
obsidian vault='dev-vault' open path=fixtures/01-standard.md
obsidian vault='dev-vault' command id=markdown-to-cv:open-preview
npm run test:host
npm run test:pdf
npm run test:lifecycle
```

# 当前限制与待验收

- **CV-03：** 原生粘贴、撤销重做通过；真实中文输入法组字与候选选择待人工验收。
- **CV-09：** 短时响应基线通过；30 分钟持续使用、1–3 页大样本性能、稳定内存增量和 5 用户任务测试未做。
- **CV-12：** 默认主题和冲突 CSS 隔离通过；常见第三方主题未测。
- **PDF 支持范围：** 只实测当前 macOS 27.0 / Obsidian 1.13.7 / Electron 39.7.0。使用隔离的宿主非公共 PDF 兼容层，接口变化会明确报错，不宣称公共稳定 API。
- **字体：** 已内置思源黑体 CN 2.005R 官方可变 WOFF2（7.71 MB），无需系统安装；正文/章节/姓名为 400/500/700。Poppler 与 PDFKit 的正文复制、搜索通过；忽略 PDF ActualText 的提取器和官方字库未覆盖的罕见字符仍有边界。
- **恢复框架：** 原文快照＋修复副本已实现并验证内容保留；这一可逆交互尚待用户体验确认。只修复明确标记，不推测归属或补回删掉的模块。
- **内容边界：** 标准静态 Markdown 先行；大型表格、动态插件输出、复杂嵌入、远程图片和极端资源等待场景尚未完成兼容验收。密度档位未实现。

开发未发布社区插件、未创建远端仓库、未推送代码。完整填写与投递品质仍需真实用户体验验收。

# 2026-10-03 体验反馈：静默预览

已在现有隔离测试 Vault 部署最小显示调整：常规预览只显示 `A4 · N 页`，导出成功只显示路径，不显示耗时。字体、模板和排版未变；来源、错误、导出进度/取消及内部计时保留。PRD 与 CV-09 仅修正原先要求显示更新状态的文字。

类型检查和构建通过；确认正常更新/就绪状态计算样式一致、错误色保留，同页数不重复写入读屏提示文本。唯一虚构笔记的最新编辑已进入预览。用户切换标签和关闭预览后停止 UI 自动化，保留当前状态与完整原生缓冲区；临时脚本的完整 DOM 观察未完成，本轮未执行真实 PDF 导出，不将旧结果算作本轮验证。详见源码目录 `docs/DEVELOPMENT.md` 及 `evidence/quiet-ui-1791031735184/`。未修改用户正在填写的源笔记或 Downloads 中的 PDF。

# 2026-10-03 默认字体：内置思源黑体

已部署官方简体中文 CN 2.005R 可变 WOFF2（7,711,988 字节），随插件分发原文件、来源、校验值和 OFL 许可。正文 Regular 400、章节与公司/项目名 Medium 500、姓名与显式加粗 Bold 700，普通 Markdown 斜体保留。预览和 PDF 使用同一份内置字体，离线资源无需系统安装；暖渲染复用字节与 FontFace，正常预览提示继续静默。

类型检查、构建和 11 项原有逻辑测试通过。后台虚构标准简历 1 页、跨页简历 2 页；Poppler/PDFKit 逐页正文仅忽略空白比较通过，中文/英文搜索与选择、真正部首字符保留、链接、内嵌字形和三页视觉检查通过。四次暖渲染约 6–11 ms，额外字体读取 0 次。用户原生编辑器、缓冲区、当前标签及工作区保持；未向编辑器注入测试文字、未覆盖用户 PDF。

当前 PDF 通过 ActualText 保留原文；pypdf 等忽略它的提取器可能误读同形汉字，未承诺所有 ATS 兼容，也未重写字体或原文码点。官方 CN 字库覆盖 30,926 个码点，并非所有 Unicode/罕见姓名用字。完整结果与样例位于源码目录 `docs/DEVELOPMENT.md`、`evidence/source-han-font/`、`output/pdf/source-han-1791034140423/`。
