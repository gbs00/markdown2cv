# 打包与发布

更新：2026-10-04。源码仓库为 [gbs00/markdown2cv](https://github.com/gbs00/markdown2cv)，初始为私有仓库。当前版本是 **0.1.0 开发版**；源码推送、手动安装包和社区市场上架是三个独立步骤，尚未创建 GitHub Release 或提交社区审核。

## 本地打包与手动测试

在仓库根目录运行，需要 Node.js、npm 和 Python 3：

```sh
npm ci
npm test
npm run package:manual
```

`package:manual` 会进行类型检查、构建不含内联 sourcemap 的插件，并生成：

```text
release/markdown-to-cv-0.1.0-manual.zip
release/markdown-to-cv-0.1.0-manual.zip.sha256
```

ZIP 内部结构：

```text
markdown-to-cv/
  main.js
  manifest.json
  styles.css
  fonts/
    SourceHanSansCN-VF.ttf.woff2
    LICENSE.txt
    SOURCE.md
```

解压后，将完整 `markdown-to-cv` 目录放到一个测试 Vault 的 `.obsidian/plugins/`，重新加载 Obsidian，在社区插件设置中启用 Markdown to CV。先验证新建、预览、修改、照片和导出 PDF。现有用户笔记不包含在 ZIP 中。

脚本会核对版本、字体 SHA-256、ZIP 完整性以及全部文件内容。它只生成本地文件，不发布 Release，也不安装到任何 Vault。此 ZIP 支持完整目录的手动安装，不能直接作为社区市场安装包。

## 社区市场所需文件

官方安装器按 GitHub Release 的版本标签下载 `main.js`、`manifest.json` 和可选的 `styles.css`。只上传源码或 ZIP 不足以完成市场安装，字体等独立附加目录也不会随这三个文件自动安装。[官方文件下载规则](https://github.com/obsidianmd/obsidian-releases#how-community-plugins-are-pulled)

## 当前发布前差距

- **字体打包：** 当前 `src/main.ts` 从插件目录读取 `fonts/SourceHanSansCN-VF.ttf.woff2`，手动完整安装可以工作，但市场安装会缺失它。上架前需改为把字体内嵌进安装器支持的文件，并调整预览与 PDF 的共享加载路径。例如打进 `main.js`，或以 data URL 放入 CSS 并处理 Shadow DOM 的加载。仍需保留字体许可及来源；不采用首次启动下载字体的方式。
- **字体验收：** 必须用只含上述三个安装文件的全新 Vault，断网验证 400/500/700 字重、照片、分页和 PDF；测量打包后的启动开销、内存与体积，不能沿用独立字体目录方案的结果。
- **插件许可证：** 仓库尚未选择源码许可证。思源黑体的 SIL OFL 1.1 只覆盖字体，不能替代插件根目录 `LICENSE`。发布前需确定源码许可证、补全作者信息，并在分发产物保留字体许可。[官方许可与披露要求](https://docs.obsidian.md/community-directory/developer-policies)
- **兼容边界：** `isDesktopOnly: true` 保持不变；当前只在 macOS 27.0 / Obsidian 1.13.7 验证，未验收 Windows/Linux 或移动端。`minAppVersion: 1.13.0` 仍需实测确认。PDF 使用非公共宿主桥接 `@electron/remote`，需检查目标版本可用性及失败提示，不能把当前可用等同于永久稳定。
- **产品验收：** 补真实中文输入法、常见主题、长时间使用、真实用户任务和干净安装/升级测试。具体状态见 [验收矩阵](ACCEPTANCE.md)。
- **公开前整理：** 确认插件 ID 在社区唯一；完善 README、作者、版本说明及源码许可，随后将仓库设为公开。当前仓库不包含测试 Vault、个人简历、原始截图、日志及导出 PDF。

## 首次上架流程

1. 完成上述差距，让公开仓库根目录包含准确的 `README.md`、`LICENSE`、`manifest.json`。当前插件 ID 是 `markdown-to-cv`，与 GitHub 仓库名不同没有关系。
2. 更新 `manifest.json` 和 `package.json` 的版本，维护 `versions.json` 中的最低 Obsidian 版本映射，构建并检查。创建 GitHub Release，标签必须与 manifest 版本完全相同，例如 `0.1.0`，不要写成 `v0.1.0`。给 Release 单独上传 `main.js`、`manifest.json`、`styles.css`；确认这些文件自身包含运行所需资源。[官方提交指南](https://docs.obsidian.md/plugins/releasing/submit-plugin)
3. 登录 [Obsidian Community](https://community.obsidian.md)，关联 GitHub 账号，在 **Plugins → New plugin** 中填写仓库地址、选择所有者，确认开发者政策后提交。[官方账号与提交说明](https://docs.obsidian.md/community-directory/set-up-and-claim)
4. 根据目录中的自动审核反馈修改代码、递增版本并发布新 Release。解决错误后完成发布，用户才可在 Obsidian 内搜索安装。按当前官方流程使用 Community 网站提交，不按旧教程向 `obsidian-releases` 发插件登记 PR。[官方审核流程](https://docs.obsidian.md/plugins/releasing/submit-plugin)

后续更新通过新的 GitHub Release 提供，标签、根目录 manifest 和发布资产中的版本保持一致；兼容性发生变化时维护 `versions.json`。发布之前始终从真实发布资产做一次干净安装验证。
