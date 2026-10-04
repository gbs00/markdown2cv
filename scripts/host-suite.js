(async () => {
  const fs = require('fs');
  const path = require('path');
  const vault = app.vault.adapter.getBasePath();
  if (vault !== '/Users/gbs00/Projects/markdown-to-cv/dev-vault' || !fs.existsSync(path.join(vault, '.markdown-to-cv-dev-vault'))) throw Error('Refusing non-test Vault');
  const root = path.dirname(vault), evidence = path.join(root, 'evidence');
  const result = { status: 'running', startedAt: new Date().toISOString(), obsidian: hostVersion, electron: process.versions.electron, tests: [], fixtures: {}, exports: [] };
  const save = () => fs.writeFileSync(path.join(evidence, 'host-results.json'), JSON.stringify(result, null, 2));
  const assert = (value, message) => { if (!value) throw Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async (predicate, label, timeout = 10000) => {
    const start = performance.now();
    while (!predicate()) { if (performance.now() - start > timeout) {
      const current=app.plugins.plugins['markdown-to-cv']?.views()[0];
      throw Error(`Timed out: ${label}; source=${current?.source?.path}; rendered=${current?.current?.snapshot.path}; status=${current?.contentEl.querySelector('.mcv-status')?.textContent}`);
    } await sleep(20); }
  };
  const test = async (name, ids, fn) => {
    try { const details = await fn(); result.tests.push({ name, ids, status: 'pass', details }); }
    catch (error) { result.tests.push({ name, ids, status: 'fail', error: String(error.stack ?? error) }); }
    save();
  };
  save();
  try {
    const plugin = app.plugins.plugins['markdown-to-cv'];
    assert(plugin, 'Plugin must be enabled in dev-vault');
    const sourceLeaf = app.workspace.getLeaf('tab');
    let view;
    async function open(filePath) {
      const file = app.vault.getAbstractFileByPath(filePath); assert(file?.extension === 'md', `Missing ${filePath}`);
      app.workspace.setActiveLeaf(sourceLeaf, { focus: true });
      await sourceLeaf.openFile(file, { state: { mode: 'source' } });
      view = await plugin.openPreview(file);
      const expected = sourceLeaf.view.editor.getValue();
      await wait(() => view.current?.snapshot.path === file.path && view.current?.snapshot.text === expected && view.contentEl.querySelector('.mcv-status').dataset.state === 'ready', filePath);
      return file;
    }
    async function exportTo(name) {
      const target = path.join(root, 'output', 'pdf', name);
      await view.exportPdf(target); result.exports.push(view.lastExport); save();
      assert(view.lastExport?.status === 'success', view.lastExport?.message ?? 'Export failed');
      assert(fs.readFileSync(target).subarray(0, 5).toString() === '%PDF-', 'Missing real PDF bytes');
      return target;
    }
    const names = ['01-standard','02-ordinary','03-free-structure','04-pagination','04b-long-paragraph','05-damaged','06-empty-fields','06b-empty'];
    for (const name of names) await test(`fixture ${name}`, ['CV-02','CV-04','CV-05','CV-06','CV-10','CV-13','CV-14'], async () => {
      const file = await open(`fixtures/${name}.md`);
      const pageText = Array.from(view.current.pages.querySelectorAll('.cv-page-content')).map(p => p.innerText);
      const actual = pageText.join('\n');
      const source = fs.readFileSync(path.join(root, 'fixtures', `${name}.md`), 'utf8');
      assert(await app.vault.read(file) === source, 'Fixture source was modified');
      assert(!actual.includes('cv_template:'), 'Frontmatter leaked into resume');
      if (name === '01-standard') for (const token of ['林示例','工作经历','项目经历','教育经历','技能','本科（自由文本）']) assert(actual.includes(token), `Missing ${token}`);
      if (name === '03-free-structure') for (const token of ['技能与兴趣','志愿活动','职业足迹','示例甲公司','示例乙公司','示例学院','示例开放大学']) assert(actual.includes(token), `Missing ${token}`);
      if (name === '04-pagination') { assert(view.current.pageCount === 2, 'Expected two pages'); for(let i=1;i<=28;i++) assert(actual.includes(`任务 ${String(i).padStart(2,'0')}`), `Missing task ${i}`); assert(actual.includes('END-CV-完整保留'), 'Missing tail'); }
      if (name === '04b-long-paragraph') for(let i=0;i<180;i++) assert(actual.replace(/\s/g,'').includes(`第${String(i).padStart(3,'0')}句`), `Missing sentence ${i}`);
      if (name === '05-damaged') assert(view.current.issues.length >= 3 && actual.includes('A17'), 'Lost damaged content or diagnostics');
      if (name === '06-empty-fields') { assert(view.current.hiddenFields === 6, 'Expected six empty fields'); assert(!actual.includes('邮箱地址'), 'Empty label remains'); assert(actual.includes('工作内容'), 'Populated block label removed'); }
      if (name === '06b-empty') assert(actual.trim() === '', 'Empty source generated content');
      const overflow = Array.from(view.current.pages.querySelectorAll('.cv-page-content')).map(p => ({ extraHeight: p.scrollHeight-p.clientHeight, extraWidth: p.scrollWidth-p.clientWidth }));
      assert(overflow.every(p => p.extraHeight <= 1 && p.extraWidth <= 1), `Overflow ${JSON.stringify(overflow)}`);
      const headingsAtBottom = Array.from(view.current.pages.querySelectorAll('.cv-page-content')).slice(0,-1).map(p => p.lastElementChild?.lastElementChild?.tagName ?? '');
      assert(headingsAtBottom.every(tag => !/^H[1-6]$/.test(tag)), 'Orphaned heading');
      result.fixtures[name] = { pages: view.current.pageCount, pageText, overflow, issues: view.current.issues, hiddenFields: view.current.hiddenFields };
      return { pages: view.current.pageCount, overflow, issues: view.current.issues.length };
    });
    await test('new resume command and unassigned shortcuts', ['CV-01'], async () => {
      const file = await plugin.createResume();
      assert(await app.vault.read(file) === fs.readFileSync(path.join(root,'src','template.md'),'utf8'), 'Template differs');
      view = plugin.views()[0]; await wait(() => view.current?.snapshot.path === file.path, 'new resume');
      for(const cmd of ['new-resume','open-preview','export-pdf','restore-framework']) assert(!app.commands.commands[`markdown-to-cv:${cmd}`]?.hotkeys?.length, 'Default hotkey should not be forced');
      return { path: file.path, source: view.source.path };
    });
    if (!app.vault.getAbstractFileByPath('qa-runtime')) await app.vault.createFolder('qa-runtime');
    const mutablePath = 'qa-runtime/current.md';
    let mutable = app.vault.getAbstractFileByPath(mutablePath);
    if (!mutable) mutable = await app.vault.create(mutablePath, '# 初始内容\n');
    await open(mutablePath);
    await test('latest unsaved buffer, retained preview, rapid edits and file switching', ['CV-03','CV-07','CV-08','CV-09'], async () => {
      const previous = view.current;
      const latest = '# 最新未落盘内容\n\nLIVE-BUFFER-V1';
      sourceLeaf.view.editor.setValue(latest);
      const captured = await plugin.capture(mutable);
      const diskAtCapture = await app.vault.read(mutable);
      assert(captured.text === latest, 'Capture missed editor buffer');
      await sleep(20);
      assert(view.current === previous && view.contentEl.querySelector('.mcv-status').dataset.state === 'updating', 'Previous preview not retained during update');
      for (let i=0;i<12;i++) sourceLeaf.view.editor.setValue(`# 连续更新 ${i}\n\nFINAL-${i}`);
      await wait(() => view.current?.snapshot.text.includes('FINAL-11'), 'last edit');
      const a=app.vault.getAbstractFileByPath('fixtures/01-standard.md'), b=app.vault.getAbstractFileByPath('fixtures/02-ordinary.md');
      app.workspace.setActiveLeaf(sourceLeaf,{focus:true});
      for(const file of [a,b,a,b,a]) await sourceLeaf.openFile(file,{state:{mode:'source'}});
      await wait(()=>view.current?.snapshot.path===a.path,'switching');
      assert(!view.current.pages.innerText.includes('普通 Markdown 笔记'), 'Mixed note content');
      await open(mutablePath);
      return { unsavedProven: diskAtCapture !== latest, sourceAfterSwitch: a.path };
    });
    await test('diagnostic navigates to the original line', ['CV-10'], async () => {
      await open('fixtures/05-damaged.md');
      const line = view.current.issues[0].line;
      view.contentEl.querySelector('.mcv-issues button').click();
      await wait(() => app.workspace.activeLeaf?.view?.editor?.getCursor().line === line,'diagnostic location');
      return { line: line+1 };
    });
    await test('theme CSS does not change paper typography or page count', ['CV-11','CV-12'], async () => {
      await open('fixtures/01-standard.md');
      const h=view.current.pages.querySelector('h1'), p=view.current.pages.querySelector('p');
      const before={ h:getComputedStyle(h).fontSize,p:getComputedStyle(p).fontSize,color:getComputedStyle(p).color,pages:view.current.pageCount };
      const stress=document.createElement('style');stress.textContent='body p {font-size:51px!important;letter-spacing:9px!important;} body h1 {color:red!important;font-family:serif!important;}';document.head.append(stress);
      try { const after={ h:getComputedStyle(h).fontSize,p:getComputedStyle(p).fontSize,color:getComputedStyle(p).color,pages:view.current.pageCount };assert(JSON.stringify(before)===JSON.stringify(after),'Host CSS leaked');return before; }
      finally { stress.remove(); }
    });
    for (const [fixture,pdf] of [['01-standard','standard.pdf'],['04-pagination','two-page.pdf'],['04b-long-paragraph','long-paragraph.pdf']]) await test(`real PDF ${fixture}`, ['CV-13','CV-14','CV-15','CV-16','CV-17'], async()=>{
      await open(`fixtures/${fixture}.md`); const target=await exportTo(pdf); return { path:target, htmlPages:view.current.pageCount, milliseconds:view.lastExport.milliseconds };
    });
    await test('local image resource loads before preview and PDF', ['CV-15','CV-16'], async()=>{
      await open('fixtures/07-local-resource.md');
      const images=Array.from(view.current.pages.querySelectorAll('img'));
      assert(images.length===1&&images.every(img=>img.complete&&img.naturalWidth>0),'Resource was not ready');
      const target=await exportTo('local-resource.pdf');return {path:target,images:images.length};
    });
    await test('export freezes click-time unsaved text while later edits continue', ['CV-15'], async () => {
      await open(mutablePath);
      sourceLeaf.view.editor.setValue('# 点击版本\n\nCLICK-TIME-V1 中文工作方向页面\n\n[链接](https://example.com/snapshot)');
      const pending = view.exportPdf(path.join(root,'output','pdf','click-snapshot.pdf'));
      sourceLeaf.view.editor.setValue('# 后续编辑\n\nAFTER-CLICK-V2');
      await pending; assert(view.lastExport.status==='success',view.lastExport.message);
      await wait(()=>view.current?.snapshot.text.includes('AFTER-CLICK-V2'),'later editing');
      result.exports.push(view.lastExport);return { ...view.lastExport, preview:view.current.snapshot.text };
    });
    await test('cancel, real write failure and retry', ['CV-18'], async () => {
      const canceled=path.join(root,'tmp','pdfs','canceled.pdf');try{fs.unlinkSync(canceled);}catch{}
      const pending=view.exportPdf(canceled);view.cancelExport();await pending;
      assert(view.lastExport.status==='canceled'&&!fs.existsSync(canceled),'Canceled export wrote file or reported success');
      await view.exportPdf(path.join(root,'tmp','nonexistent-directory','failed.pdf'));
      assert(view.lastExport.status==='error','Write failure not reported');const failure=view.lastExport.message;
      await exportTo('retry.pdf'); return { cancel:'no file',failure,retry:'success' };
    });
    await test('repair preserves exact unsaved snapshot, ambiguous text and intentional structure', ['CV-19','CV-20','CV-21','CV-22'], async()=>{
      await open(mutablePath);
      const text=fs.readFileSync(path.join(root,'fixtures','05-damaged.md'),'utf8')+'\nUNSAVED-REPAIR-完整原文\n';
      sourceLeaf.view.editor.setValue(text);
      const repaired=await plugin.repair(mutable);
      const original=await app.vault.read(repaired.original), output=await app.vault.read(repaired.repaired);
      assert(original===text,'Snapshot is not exact click-time source');
      assert(output.includes('### 未加空格的公司标题')&&output.includes('**职位：** 工程师'),'Clear structure not repaired');
      for(const token of ['A17','42%','UNSAVED-REPAIR-完整原文','## 自定义章节','###代码中的标题不能被修复'])assert(output.includes(token),`Lost ${token}`);
      assert(!/## (工作经历|项目经历|教育经历|技能)\n/.test(output),'Deleted modules reintroduced');
      assert(sourceLeaf.view.editor.getValue()===text,'Original editor overwritten');
      return { original:repaired.original.path,repaired:repaired.repaired.path,originalLength:original.length };
    });
    await test('rename, move, host save and reopen preserve association', ['CV-23','CV-24'], async()=>{
      const stamp=Date.now(); const f=await app.vault.create(`qa-runtime/lifecycle-${stamp}.md`,'# 生命周期\n');
      await open(f.path); const next=`# 保存并重开\n\nPERSIST-${stamp}`;sourceLeaf.view.editor.setValue(next);
      await sourceLeaf.view.save();
      if(!app.vault.getAbstractFileByPath('qa-runtime/moved'))await app.vault.createFolder('qa-runtime/moved');
      await app.fileManager.renameFile(f,`qa-runtime/moved/renamed-${stamp}.md`);
      await wait(()=>view.current?.snapshot.path===f.path&&view.current.snapshot.text===next,'renamed association');
      await sourceLeaf.openFile(app.vault.getAbstractFileByPath('START.md'));
      await open(f.path);assert(sourceLeaf.view.editor.getValue()===next,'Reopened saved text differs');
      return { newPath:f.path,saved:true };
    });
    await test('preview latency baseline on repeated one-page edits', ['CV-09'], async()=>{
      await open(mutablePath); const samples=[];
      for(let i=0;i<12;i++) { const text=`# 基线 ${i}\n\n中文输入与 Markdown preview 测试 ${i}`;const start=performance.now();sourceLeaf.view.editor.setValue(text);await wait(()=>view.current?.snapshot.text===text,'baseline');samples.push(performance.now()-start); }
      const sorted=[...samples].sort((a,b)=>a-b);return { samples,p95:sorted[Math.ceil(samples.length*.95)-1],method:'editor.setValue to matching preview; 20ms polling; no native IME claim' };
    });
    await open('fixtures/01-standard.md');
    result.metrics=plugin.views()[0].metrics;
    result.status='complete'; result.finishedAt=new Date().toISOString(); save();
  } catch(error) { result.status='failed';result.error=String(error.stack??error);save(); }
})()
