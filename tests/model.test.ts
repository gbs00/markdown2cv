import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abortable } from '../src/async';
import { prepareMarkdown, repairMarkdown, RevisionGate } from '../src/model';
const fixture = (name: string) => readFileSync(`fixtures/${name}.md`, 'utf8');

test('CV-06: blank contact/custom values disappear, populated block labels and source lines survive', () => {
  const input = fixture('06-empty-fields'); const p = prepareMarkdown(input);
  assert.equal(p.hiddenFields, 6);
  assert.doesNotMatch(p.markdown, /\*\*(求职方向|手机号码|邮箱地址|作品集或博客|职位|自定义空字段)：\*\*/);
  assert.match(p.markdown, /\*\*工作内容：\*\*/);
  assert.match(p.markdown, /保留有正文的工作内容标签/);
  assert.equal(p.markdown.split('\n').length, input.split('\n').length);
  assert.match(input, /\*\*作品集或博客：\*\*/);
});
test('CV-02/05: ordinary/custom/reordered/multiple records are byte-preserved', () => {
  for (const file of ['02-ordinary', '03-free-structure']) {
    const input = fixture(file); assert.equal(prepareMarkdown(input).markdown, input); assert.equal(repairMarkdown(input).text, input);
  }
});
test('CV-10: damaged structure returns original content and original line numbers', () => {
  const input = fixture('05-damaged'); const p = prepareMarkdown(input);
  assert.equal(p.markdown, input);
  for (const issue of p.issues) assert.ok(input.split('\n')[issue.line]?.trim());
  assert.ok(p.issues.some(i => i.message.includes('空格')));
  assert.ok(p.issues.some(i => i.message.includes('层级')));
});
test('CV-19..22: repair only clear marker damage; every body value, code and custom section remains', () => {
  const input = fixture('05-damaged'); const r = repairMarkdown(input);
  assert.equal(r.changes.length, 2);
  assert.match(r.text, /### 未加空格的公司标题/);
  assert.match(r.text, /\*\*职位：\*\* 工程师/);
  for (const phrase of ['待核对的业务描述 A17', '保留中文、English、符号 42%', '###### 跳跃层级', '## 自定义章节', '###代码中的标题不能被修复', '**职位：代码示例']) assert.ok(r.text.includes(phrase), phrase);
  assert.doesNotMatch(r.text, /## (工作经历|项目经历|教育经历|技能)\n/);
  assert.equal(repairMarkdown(r.text).text, r.text);
});
test('fences/frontmatter/indented code are excluded from field adaptation and repair', () => {
  const input = '---\nlabel: "**职位："\n---\n\n````md\n```\n**职位：**\n###无空格\n````\n\n    **职位：**\n';
  assert.equal(prepareMarkdown(input).hiddenFields, 0);
  assert.equal(repairMarkdown(input).text, input);
});
test('unclosed YAML and empty input never discard source', () => {
  assert.equal(prepareMarkdown('').markdown, '');
  const input = '---\ncv_template: basic\n标题值';
  assert.equal(prepareMarkdown(input).markdown, input); assert.ok(prepareMarkdown(input).issues.length);
  assert.equal(repairMarkdown(input).text, input);
});
test('CV-10: dynamic blocks fall back to visible source text instead of disappearing', () => {
  const input = '<canvas>保留动态内容</canvas>\n\n```dataviewjs\nconsole.log("原文");\n```';
  const result = prepareMarkdown(input);
  assert.match(result.markdown, /&lt;canvas&gt;保留动态内容&lt;\/canvas&gt;/);
  assert.match(result.markdown, /```text\nconsole.log\("原文"\);/);
  assert.equal(result.issues.length, 2);
});
test('CV-08: rapid note switches and late results cannot commit', async () => {
  const gate = new RevisionGate();
  const oldA = gate.request('A.md'), oldB = gate.request('B.md'), newA = gate.request('A.md');
  const results = await Promise.all([newA, oldA, oldB].map(async ticket => ({ ticket, accepted: gate.accepts(ticket) })));
  assert.deepEqual(results.map(r => r.accepted), [true, false, false]);
  gate.invalidate(); assert.equal(gate.accepts(newA), false);
});
test('CV-18: cancel does not wait for an unresolved resource; late rejection is handled', async () => {
  const controller = new AbortController();
  const pending = abortable(new Promise<void>(() => {}), controller.signal, 5000);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
