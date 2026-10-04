import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMarkdown, repairMarkdown } from '../src/model';

test('photo field belongs only to the name header; code and body images survive', () => {
  const input = '---\ncv_version: 1\n---\n\n# 虚构姓名\n\n```md\n**照片：** ![[code.png]]\n```\n\n**照片：** ![[附件/照片 (1).png|150]]\n\n**手机号码：** 13000000000\n\n## 作品\n\n**照片：** ![[body.png]]\n\n![正文图片](body.jpg)';
  const result = prepareMarkdown(input);
  assert.deepEqual(result.photo, { line: 10, markdown: '![[附件/照片 (1).png|150]]' });
  assert.match(result.markdown, /\*\*照片：\*\* !\[\[code.png\]\]/);
  assert.match(result.markdown, /\*\*照片：\*\* !\[\[body.png\]\]/);
  assert.match(result.markdown, /!\[正文图片\]\(body.jpg\)/);
  assert.equal(result.markdown.split('\n').length, input.split('\n').length);
  assert.equal(repairMarkdown(input).text, input);
});

test('blank photo field collapses without consuming text or indented code', () => {
  for (const body of ['保持这段介绍。', '    ![[code.png]]', '![附图](image.png) 后面还有正文']) {
    const input = `# 姓名\n\n**照片：**\n\n${body}\n\n## 工作\n\n正文`;
    const result = prepareMarkdown(input);
    assert.equal(result.photo, undefined);
    assert.equal(result.hiddenFields, 1);
    assert.ok(result.markdown.includes(body));
    assert.equal(result.markdown.split('\n').length, input.split('\n').length);
  }
});

test('a standalone image after the photo label is accepted without changing source lines', () => {
  const input = '# 姓名\n\n**照片：**\n\n![照片](<附件/照片 (1).png>)\n\n**求职方向：** 工程师';
  const result = prepareMarkdown(input);
  assert.deepEqual(result.photo, { line: 2, markdown: '![照片](<附件/照片 (1).png>)' });
  assert.equal(result.markdown.split('\n').length, input.split('\n').length);
  assert.match(result.markdown, /\*\*求职方向：\*\* 工程师/);
});

test('multiple photos cannot silently pick one for export', () => {
  const input = '# 姓名\n\n**照片：** ![[first.png]]\n\n**照片：** ![[second.png]]';
  const result = prepareMarkdown(input);
  assert.equal(result.photo, undefined);
  assert.ok(result.issues.some(issue => issue.blocksExport && issue.line === 4));
  assert.equal(repairMarkdown(input).text, input);
});

test('ordinary notes without a name heading retain image fields in place', () => {
  const input = '**照片：** ![[ordinary.png]]\n\n## 内容\n\n# 后续标题\n\n**照片：** ![[later.png]]';
  const result = prepareMarkdown(input);
  assert.equal(result.photo, undefined);
  assert.equal(result.markdown, input);
});

test('repairing a damaged photo label preserves its exact attachment reference', () => {
  const input = '# 姓名\n\n**照片： ![[附件/照片 (1).png]]';
  const result = repairMarkdown(input);
  assert.equal(result.text, '# 姓名\n\n**照片：** ![[附件/照片 (1).png]]');
  assert.equal(result.changes.length, 1);
});

test('photo examples inside Obsidian or HTML comments stay hidden and unmodified', () => {
  for (const [open, close] of [['%%', '%%'], ['<!--', '-->']]) {
    const input = `# 姓名\n\n${open}\n\`\`\`md\n**照片：** ![[hidden.png]]\n**照片： ![[damaged-example.png]]\n${close}\n\n**照片：** ![[visible.png]]`;
    const result = prepareMarkdown(input);
    assert.equal(result.photo?.markdown, '![[visible.png]]');
    assert.equal(result.issues.length, 0);
    assert.equal(repairMarkdown(input).text, input);
  }
});
