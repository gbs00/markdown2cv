"""Reconcile recorded evidence into the development matrix; never edits requirements."""
from pathlib import Path
import json, hashlib
from datetime import datetime, timezone, timedelta
r=Path(__file__).resolve().parent.parent
read=lambda name:json.loads((r/name).read_text())
host=read('evidence/host-results.json'); pdf=read('evidence/pdf-results.json'); lifecycle=read('evidence/lifecycle-results.json')
assert host['status']=='complete' and all(x['status']=='pass' for x in host['tests'])
assert all(all(x['checks'].values()) for x in pdf) and lifecycle['passed']
cases=read('docs/cases.json')
steps={
'CV-01':'点击新建简历/运行命令；比对模板全文，核对关联文件与默认快捷键。',
'CV-02':'打开 02-ordinary.md，运行打开预览；核对无属性也显示标题、列表、引用和链接。',
'CV-03':'在 qa-runtime/native-input.md 原生粘贴中英文，⌘Z、⇧⌘Z；另做真实中文输入法组字验收。',
'CV-04':'打开 01-standard.md；核对姓名、五模块与自由学历文本。',
'CV-05':'打开 03-free-structure.md；核对改名/重排/自定义章节及重复记录顺序。',
'CV-06':'打开 06-empty-fields.md；空标签应收起六项，有正文的工作内容标签保留，源文件不改。',
'CV-07':'原生编辑器立即 setValue，尚未落盘时取快照；等待 HTML 更新并核对最新文本。',
'CV-08':'连续编辑 12 次，再在活动原生标签快速 A/B/A/B/A 切换；核对最后关联及内容。逻辑测试额外验证旧结果晚到。',
'CV-09':'更新的 70 ms 合并窗口中检查上一版仍可见；记录 12 次程序化编辑到预览延迟；真实 IME/30 分钟另测。',
'CV-10':'打开 05-damaged.md，点击诊断定位原行；动态 HTML/查询以源码文本回退，不静默丢弃。',
'CV-11':'查看 standard.pdf 与 HTML；核对 A4、16 mm 页边距、层级、字体与间距。',
'CV-12':'向宿主文档临时施加冲突 CSS，检查 Shadow DOM 字号/颜色/页数不变；常见第三方主题另测。',
'CV-13':'依次打开一页标准、两页分页和两页超长段落；核对 DOM 页数及实际 PDF 页数。',
'CV-14':'检查任务 01–28、页末标题和 180 句超长段落；检查 HTML 溢出量与 PDF 每页文字顺序、页面图像。',
'CV-15':'点击时写入 V1 未保存内容，开始导出后改为 V2；PDF 只能含 V1；本地图片加载后导出。',
'CV-16':'对三份 PDF 与对应 HTML 逐页去空白比较文字顺序，不做 Unicode 兼容归一化；检查字体与视觉布局。',
'CV-17':'pypdf 提取中英文，检查字符准确/阅读顺序/URI 注释；人工翻页检查字形及长链接。',
'CV-18':'原生保存对话框取消、程序取消、向不存在目录写出失败后重试；不得假报成功或留下半文件。',
'CV-19':'给损坏样例追加未保存标记后修复；原文快照必须与点击时全文逐字一致。',
'CV-20':'核对缺标题空格、字段粗体标记的两处明确修复；字段值和正文不变。',
'CV-21':'检查 A17、42%、无归属文字及待整理说明；不把含混正文分配到猜测的模块。',
'CV-22':'修复自定义/改名/删模块样例；不得补回默认工作/项目/教育/技能模块。',
'CV-23':'通过宿主 save 保存，打开其他笔记后重新打开；核对保存内容和预览。',
'CV-24':'通过 FileManager 移动并改名；核对新路径、源关联与再次编辑。',
'CV-25':'停用/启用三轮；停用后预览、离屏测量节点和 PDF 窗口均为零，启用后只一个有效预览。',
}
pending={
'CV-03':'原生粘贴/撤销/重做与程序化中文编辑通过；真实拼音输入法组字、候选选择待人工验收。',
'CV-09':'保留上一版和短时基线通过；真实输入响应、1–3 页大样本及30分钟稳定性未测。',
'CV-12':'默认主题与冲突CSS隔离通过；常见第三方主题清单及切换实测未完成。',
}
for c in cases:
 c['implementation']='已实现（0.1.0 开发版）'
 c['test']='部分通过；待人工/扩展验收' if c['id'] in pending else '开发样例技术验证通过'
 c['steps']=steps[c['id']]
 c['actual']=pending.get(c['id'],'对应自动/宿主/页面检查通过；用户填写体验未作为已验收。')
 c['evidence']=['../evidence/host-results.json']
 if c['id'] in ['CV-03']:c['evidence']+=['../evidence/native-input.json']
 if c['id'] in [f'CV-{i:02}' for i in range(13,18)]:c['evidence']+=['../evidence/pdf-results.json','../output/pdf/']
 if c['id']=='CV-18':c['evidence']+=['../evidence/native-dialog-cancel.json','../evidence/build-and-unit.log']
 if c['id']=='CV-25':c['evidence']=['../evidence/lifecycle-results.json']
 if c['id'] in ['CV-06','CV-08','CV-10','CV-19','CV-20','CV-21','CV-22']:c['evidence']+=['../evidence/build-and-unit.log']
(r/'docs/cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
header='# 验收矩阵 · 0.1.0 开发版\n\n2026-10-03，Asia/Shanghai。25 项均有开发实现；22 项在约定样例中完成技术验证，CV-03/09/12 部分通过并保留明确待测项。技术验证不代表已通过真实用户体验验收。原 PRD、功能清单和模板未改写。\n\n状态区分：规划 → 已实现 → 对应范围已测通过 → 用户体验待验收。本表不把构建/单测当整项产品验收。\n\n|编号|功能|可执行步骤|期望|实现|实际状态与边界|证据|\n|---|---|---|---|---|---|---|\n'
for c in cases:
 evidence='、'.join(f'[{Path(x).name or "PDF"}]({x})' for x in c['evidence'])
 header+=f'|{c["id"]}|{c["name"]}|{c["steps"]}|{c["expected"]}|{c["implementation"]}|{c["test"]}：{c["actual"]}|{evidence}|\n'
header+='\n## 整体未验收项\n\n- 真实中文 IME、常见第三方主题、其他 Obsidian/macOS 版本。\n- 30 分钟持续使用与 5 用户任务测试；跨设备内存/延迟预算。\n- 原文快照＋修复副本的最终交互确认；作品投递质量的真实用户判断。\n- 动态插件输出、复杂嵌入、超高表格及远程图片不在完整兼容范围内。\n- 资源“未就绪”的本地加载路径已测；人为延迟/失败字体与远程资源压力场景未覆盖。\n'
(r/'docs/ACCEPTANCE.md').write_text(header)
baseline=next(t['details'] for t in host['tests'] if t['name'].startswith('preview latency'))
exports=[t['details'] for t in host['tests'] if t['name'].startswith('real PDF')]
newest=datetime.fromisoformat(host['finishedAt'].replace('Z','+00:00')).astimezone(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S +08:00')
log=f'''# 开发与验收记录

2026-10-03，Asia/Shanghai。首个可运行开发版 **0.1.0** 已完成，安装在 `/Users/gbs00/Projects/markdown-to-cv/dev-vault`。主 Vault 没有安装本插件；未发布或推送。

## 准备与实现

准备检查已通过：最新需求与模板已读取、独立目录/本地 Git/锁定依赖建立、专用 Vault 和六类基础 fixture 就绪，25 项转为可执行矩阵。随后直接实现 M1–M3 的开发范围。详见 [准备记录](PREPARATION.md)、[逐项矩阵](ACCEPTANCE.md)、[README](../README.md)。

TypeScript/公共 Obsidian API 接入原生编辑、MarkdownRenderer、文件存储。加入结构适配、空填入字段收起、版本门控、HTML A4 分页、真实 PDF、保守修复副本和生命周期清理。没有独立应用、第二套 Chromium 或后台服务。

## 实测结果

- 构建和类型检查通过；11 个逻辑测试通过，见 [日志](../evidence/build-and-unit.log)。
- 最新真实宿主运行结束于 `{newest}`；{len(host['tests'])} 项检查全部通过，见 [宿主结果](../evidence/host-results.json)。
- 3 轮停用/启用验证通过，停用后自定义视图/测量节点/PDF 窗口均清理，见 [生命周期证据](../evidence/lifecycle-results.json)。
- 原生中英文粘贴、⌘Z、⇧⌘Z 与对应预览一致；原生保存对话框取消得到 canceled，见 [原生输入](../evidence/native-input.json)、[对话框取消](../evidence/native-dialog-cancel.json)。这不等同于真实拼音输入法组字验证。
- standard.pdf 一页、two-page.pdf 两页、long-paragraph.pdf 两页。逐页文字和顺序与 HTML 一致，字符没有被兼容归一化掩盖错误；外链 URI 存在，文字边界在页内，PNG 全页人工检查无缺字/裁切。见 [PDF 结果](../evidence/pdf-results.json) 与 [输出目录](../output/pdf/)。
- 点击版本 V1 被固定，后续 V2 留在编辑器/HTML，PDF 保持 V1。取消无文件；真实写入失败明确反馈，重试成功。
- 本地 SVG 资源加载后生成真实 PDF，见 local-resource.pdf。慢字体/极端资源失败压力测试仍未覆盖。

## 实际基线（不是承诺或通过门槛）

- 12 次一页程序化编辑 → 相应 HTML 就绪，P95 **{baseline['p95']:.1f} ms**；采样轮询分辨率 20 ms，包含 70 ms 合并等待，不代表真实 IME 输入延时。
- 本轮新建 PDF 窗口后的首次标准简历导出 **{exports[0]['milliseconds']/1000:.3f} s**；随后两页样例 **{exports[1]['milliseconds']/1000:.3f} s**、超长段落 **{exports[2]['milliseconds']/1000:.3f} s**。从操作调用到文件写入完成，包括内容处理、资源、布局和文件生成；自动化预选输出路径，不含人工保存对话框思考时间。宿主和系统缓存已预热，不代表整个应用冷启动。
- 启停前后 renderer RSS/heap 原始采样已留档。未控制 GC/系统负载，不能把瞬时差值当稳定插件增量预算；宿主整体还同时运行用户主 Vault。30 分钟稳定性和 5 用户测试未做。

## 发现与处理

1. 当前 Chromium 将 PingFang/黑体/宋体的若干汉字复制为部首字符。对比实际字体 PDF 后，统一使用本机 Arial Unicode MS，重跑中文逐字/链接/分页检查通过。缺少该字体时明确失败，不静默回退。未打包字体或重装宿主。
2. 首轮两个宿主用例在后台标签模拟切换，未触发用户活动笔记切换语义。修正 harness 使用公开 setActiveLeaf 后，按真实活动编辑器流程复测通过；初轮原始结果保留在 host-initial-results.json。
3. 分页复用已加载的渲染节点，避免复制图片后短暂失去尺寸；动态 HTML/查询回退为文本，导出不默默删除动态画布。
4. PDF 仍依赖宿主非公共 remote 桥接；兼容代码独立、运行时检查、有错误反馈，不声明 Obsidian 稳定公共支持。解析器对 Chromium 某些合成字体报告 FontBBox 警告，原始日志留存；文字、页面边界和图像实查均通过。

## 未验证与后续体验验收

CV-03：真实中文 IME；CV-09：长时稳定性、真实输入响应和1–3页大样本；CV-12：常见第三方主题。其余22项只在当前样例/版本通过技术验证。

修复副本方案、简历投递视觉质量与完整填写成本仍待用户体验验收。未测旧版 Obsidian/macOS；大型表格/复杂动态嵌入/远程图片有明确边界。可选密度档位尚未实现，未擅自扩充产品范围。
'''
(r/'docs/DEVELOPMENT.md').write_text(log)
vault_note=f'''---
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

构建和类型检查通过，**11 个逻辑测试、{len(host['tests'])} 项真实宿主检查、3 轮启停检查通过**。原生中文粘贴、撤销重做、保存对话框取消已验证。PDF 逐页文字/顺序、外链和页面图像检查通过。

- [标准简历 PDF · 1 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/standard.pdf)
- [中文/链接/分页 PDF · 2 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/two-page.pdf)
- [超长段落 PDF · 2 页](file:///Users/gbs00/Projects/markdown-to-cv/output/pdf/long-paragraph.pdf)

本轮一页程序化编辑到预览 P95 为 **{baseline['p95']:.1f} ms**（12 次样本）；首个 PDF 导出 **{exports[0]['milliseconds']/1000:.3f} 秒**，后续两份 **{exports[1]['milliseconds']/1000:.3f} / {exports[2]['milliseconds']/1000:.3f} 秒**。计时覆盖处理、资源等待、布局、生成及写入，预先指定测试路径，未包含人工选择路径时间。这只是一次实测基线，不是已批准性能标准。

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
- **字体：** 当前依赖本机 Arial Unicode MS；已修复系统其他中文字体导致的 PDF 复制字码错误。字体缺失和其他系统还需验证。
- **恢复框架：** 原文快照＋修复副本已实现并验证内容保留；这一可逆交互尚待用户体验确认。只修复明确标记，不推测归属或补回删掉的模块。
- **内容边界：** 标准静态 Markdown 先行；大型表格、动态插件输出、复杂嵌入、远程图片和极端资源等待场景尚未完成兼容验收。密度档位未实现。

开发未发布社区插件、未创建远端仓库、未推送代码。完整填写与投递品质仍需真实用户体验验收。
'''
(r/'docs/vault-record.md').write_text(vault_note)
print(f'Reports written: {len(cases)} CV cases, {len(host["tests"])} host checks, p95 {baseline["p95"]:.1f} ms')
