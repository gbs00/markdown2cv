# 0.1.1 发布验收

日期：2026-10-04。本次是 0.1.1 安装包的安装与导出验收，不代表 Obsidian 社区审核已通过。

## 环境和产物

- macOS 27.0 / Apple Silicon；Obsidian 1.13.7，安装器 1.12.4，Electron 39.7.0。
- 使用独立生成的测试 Vault，仅含仓库虚构样例；未使用真实简历。
- 新安装只有 `main.js`、`manifest.json`、`styles.css`，无 `fonts/` 目录。
- 三个文件合计 **10,357,628 字节（10.36 MB）**；手动安装 ZIP **7,813,148 字节（7.81 MB）**。MB 按十进制计算。
- 原始思源黑体 CN 2.005R 为 7,711,988 字节。构建、安装和运行时字节 SHA-256 均为 `f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799`。
- MIT 源码许可、SIL OFL 字体许可及来源全文均随安装文件分发。

## 已通过

| 验收项 | 结果 |
| --- | --- |
| 静态与构建检查 | 官方 Obsidian ESLint 推荐配置、18 项逻辑测试、TypeScript、发布构建及产物校验通过。规则例外见发布指南。 |
| 三文件安装 | 实际安装文件逐字节匹配待发布资产，预览与 PDF 不读取外部字体目录。 |
| 字体加载与缓存 | 启用插件时未解码字体；首次预览解码一次；8 次后续渲染及 3 次导出复用字节缓存。400 / 500 / 700 字重正确。 |
| 离线流程 | 对测试 Vault 渲染器和每个全新 PDF 渲染器启用 CDP 网络离线；预览、本地照片、字体和实际 PDF 导出成功。未切断电脑整体网络。 |
| 标准简历 | 预览与 PDF 均为 1 页 A4，无内容溢出。 |
| 跨页简历 | 预览与 PDF 均为 2 页 A4；页末标题随正文移到下一页，长链接完整，末尾标记保留。 |
| 带照片简历 | 1 页 A4，照片内嵌；顶部右侧展示、等比缩放、无裁切。150% 预览不改变 PDF 分页。 |
| PDF 文字 | Poppler 与 macOS PDFKit 逐页比较正文、顺序和码点；中文、英文、字形相似的部首均保留，搜索与准确选择通过。 |
| PDF 资源 | Type3 字形程序内嵌，外部链接保留，纸张尺寸正确。 |
| 卸载与重载 | 清理字体缓存、FontFace、预览和隐藏 PDF 窗口；重载后三文件安装继续正常工作。 |
| 旧版开发安装升级 | 既有开发 Vault 只替换插件文件并清理旧字体目录；原生编辑器、缓冲区、活动标签、预览叶节点与比例状态保留，新版预览就绪。 |
| 视觉检查 | 已检查标准 1 页、跨页 2 页、照片 1 页 PNG，以及真实宿主预览截图；无重叠、缺图或页边裁切。 |

PDFKit 对照片返回一个 `U+FFFC` 图片对象占位符。验收单独确认该页确实内嵌一张图片、占位符仅有一个且源文没有此字符，再比较文字；未归一化汉字、替换部首或改写 PDF。Poppler 直接逐页匹配正文。

## 测量范围

最终记录中，8 次缓存后的直接排版耗时为 **5.0–12.3 ms**；3 次冷 PDF 窗口导出约 **0.74–0.88 秒**，不包含用户选择保存位置的时间。这些是虚构小样例在本机上的观测，不作为所有设备、真实输入法或长文档的性能承诺。界面不显示耗时秒数。

## 复测与证据

```sh
npm ci
npm run check:release
npm run prepare:release-test
# 在 Obsidian 中打开生成的测试 Vault，并启用插件
npm run test:release-host
# macOS，需 Poppler、Swift/PDFKit 和 Python pypdf
python3 scripts/check-font-pdf.py evidence/release-0.1.1/host-results.json
```

宿主脚本仅对带有匹配标记的生成 Vault 执行重载。每份 PDF 使用新的隐藏渲染器，避免 Chromium 在重复 data URL 导航后重置 CDP 离线模拟，确保实际打印时 `navigator.onLine` 为 false。脚本最终恢复网络模拟并释放调试器。

本地原始结果为 `evidence/release-0.1.1/host-results.json`、`pdf-results.json`、`pdfkit-results.json`、`dev-upgrade.json`、四页 PNG 和 `preview.png`；PDF 位于 `output/pdf/release-0.1.1/`。这些文件不入库，可按上述流程重新生成。

## 剩余范围

- Windows/Linux 未验收，Android/iOS 不支持。
- 真实中文输入法组字、第三方主题、长时间稳定性和真实用户任务仍待验证。
- 本次宿主脚本指定隔离输出路径，未重新人工操作系统保存对话框。
- PDF 依赖非公共的 `@electron/remote` 宿主桥接。宿主更新后需复测；缺少接口时保留 HTML 预览并提示无法导出。
- 不承诺所有 Unicode 姓名用字或所有 ATS/提取器兼容；忽略 PDF `ActualText` 的提取器可能误读同形汉字。
- Obsidian 社区目录尚未提交，提交和审核属于后续步骤。GitHub 安装包见 [0.1.1 Release](https://github.com/gbs00/markdown2cv/releases/tag/0.1.1)。
