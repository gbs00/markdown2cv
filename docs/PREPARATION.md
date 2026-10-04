# 开发准备与技术决策

2026-10-03，Asia/Shanghai。主 Vault 仅只读需求与写开发记录；插件仅部署项目下的 `dev-vault`。未发布、未推送。

## 已检查

- 有界检索 Projects/Developer/Code/code/repos/Desktop（深度 ≤ 3）无同项目代码；唯一简历名匹配为无关静态作品集，没有 Obsidian manifest。不复用。
- macOS 27.0 (26A428)，Obsidian 1.13.7 / installer 1.12.4，Electron 39.7.0 / Chromium 142.0.7444.265，Node 24.13.0，npm 11.6.2。
- 新工程独立本地 Git；未初始化 home，目录无适用 AGENTS.md。
- 最新 PRD、功能清单、模板已读取，原文件 SHA-256 记录在 requirements-fingerprints.json；空填入字段规则覆盖所有空字段。
- TypeScript 5.9.3、esbuild 0.28.2、Obsidian API 1.13.1 与 Node 类型锁定；无产品运行时 npm 依赖。manifest 开发最低版本暂设 1.13.0，仅 1.13.7 实测，不宣称跨版本验收。
- 公共 API：ItemView、registerView、MarkdownRenderer.render、editor-change、Vault/FileManager、Component 清理；不实现通用 Markdown 解析器或编辑器。
- PDF 风险：当前宿主提供 @electron/remote、BrowserWindow 和 webContents.printToPDF。该桥接是宿主非公共接入，不属于 Obsidian 稳定 API。仅在独立兼容模块运行时检测，失败提示，不 patch 宿主、不装另一套 Chromium。

## 实现顺序与准备门槛

1. 固定六类虚构 fixture、验收矩阵、构建/部署/逻辑测试入口；检查部署只能落到 dev-vault。
2. 实现公共 API HTML 预览、最新编辑缓冲区快照、版本门控、结构保留和空字段收起。
3. 尽早验证两页中文/链接 PDF 真生成；共享固定分页 DOM 和样式，真实检查字体/文本/链接/页数。
4. 完成取消/失败处理、保守修复副本、重命名/移动/重开/卸载；宿主验证，不把类型检查当功能验收。

准备通过后直接编码。PDF 可用性是实现期实测风险，不阻止可逆本地开发。30 分钟稳定性、5 用户任务、真实中文 IME、第三方主题/动态插件与旧版本支持都须另列未测。

## 开发版可逆选择

- 恢复框架创建点击时全文快照和修复副本；原文件不改。只自动修复无歧义的标记损坏，不按章节名重排或补齐模块。修复副本交互仍待体验验收。
- 一套 A4 样式、Shadow DOM 隔离；不增加密度开关。首版的本机 Arial Unicode MS 方案已由内置思源黑体 CN 替代，当前资源与双引擎 PDF 验证见开发记录。
- 限定静态标准 Markdown；动态嵌入、复杂 HTML 等不承诺打印兼容，无法可靠排版时明确报错，不静默截断。

## 官方依据

- [Obsidian 公共 API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
- [自定义视图与组件生命周期](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md)
- [官方示例工程](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Electron 39.7 printToPDF](https://github.com/electron/electron/blob/v39.7.0/docs/api/web-contents.md#contentsprinttopdfoptions)
- [Electron remote 桥接及边界](https://github.com/electron/remote)

## 准备门槛结果

独立工程、锁定依赖、六类基础样例、25 项验收矩阵与只能部署到 dev-vault 的脚本均已检查通过，随后已进入实际实现。Obsidian 类型包的 moment 传递依赖使用开发期 override 固定 2.31.0，npm audit 为 0；该依赖不进入插件运行时包。最终结果见 DEVELOPMENT.md。
