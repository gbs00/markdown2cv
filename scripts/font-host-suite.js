return (async () => {
  const fs = require('fs'), path = require('path');
  const root = '/Users/gbs00/Projects/markdown-to-cv';
  if (app.vault.adapter.getBasePath() !== root + '/dev-vault') throw Error('Refusing non-development Vault');
  const module = {exports:{}};
  new Function('module','exports','require',fs.readFileSync(root + '/tmp/font-test-api.cjs','utf8'))(module,module.exports,require);
  const {exportHtml,PdfService,writePdfAtomically,ResumeFonts,FONT_FAMILY} = module.exports;
  const plugin = app.plugins.plugins['markdown-to-cv'];
  if (typeof plugin?.render !== 'function') throw Error('Font-enabled plugin must be loaded');
  const evidence = root + '/evidence/source-han-font/host-' + runId + '.json';
  const output = root + '/output/pdf/source-han-' + runId;
  fs.mkdirSync(output);
  const result = {status:'running',runId,hostVersion,electron:process.versions.electron,method:'Production renderer offscreen; separate hidden PDF service; repository fiction only; no editor writes, new tabs, or focus calls',fixtures:[],checks:{}};
  const save = () => fs.writeFileSync(evidence,JSON.stringify(result,null,2));
  const assert = (value,message) => { if(!value)throw Error(message); };
  const editors = app.workspace.getLeavesOfType('markdown').filter(l=>l.view.editor).map(leaf=>({leaf,editor:leaf.view.editor,text:leaf.view.editor.getValue()}));
  const active = app.workspace.activeLeaf;
  const initialLeaves=[];app.workspace.iterateAllLeaves(leaf=>initialLeaves.push(leaf));
  const controller = new AbortController(), service = new PdfService();
  const fonts = plugin.fonts, originalRead = fonts.read;
  let fontReads = 0, rendered;
  fonts.read = () => {fontReads++;return originalRead();};
  save();
  try {
    for (const [fixture,name] of [['01-standard','standard'],['04-pagination','two-page']]) {
      const base = fs.readFileSync(root + '/fixtures/' + fixture + '.md','utf8');
      const text = base + '\n\n中文复制核对：工作方向页面长；原样部首：⼯⽅⻚⾯⻓；姓名用字：仝龚邬隋昝；English / 2026.\n\n*Italic emphasis preserved*.\n';
      const snapshot = {path:'qa-runtime/font-' + runId + '-' + name + '.md',name:'虚构字体验证',text,capturedAt:Date.now()};
      const start = performance.now();
      rendered = await plugin.render(snapshot,plugin,controller.signal);
      // Compare actual DOM text. Chromium draws CSS disc markers as vector
      // decoration; do not invent extra bullet code points or strip real ones.
      const item = {fixture,name,previewPages:rendered.pageCount,previewMilliseconds:performance.now()-start,pageText:Array.from(rendered.pages.querySelectorAll('.cv-page-content')).map(p=>p.textContent),weights:{}};
      for (const selector of ['.cv-root','h1','h2','h3','strong','em']) {
        const el=selector === '.cv-root' ? rendered.pages : rendered.pages.querySelector(selector);
        const css=getComputedStyle(el);item.weights[selector]={family:css.fontFamily,weight:css.fontWeight,style:css.fontStyle,synthesis:css.fontSynthesis};
      }
      assert(item.weights['.cv-root'].weight==='400'&&item.weights.h1.weight==='700'&&item.weights.h2.weight==='500'&&item.weights.h3.weight==='500'&&item.weights.strong.weight==='700','Unexpected font weights');
      assert(Object.values(item.weights).every(x=>x.family.includes(FONT_FAMILY)),'Preview font family mismatch');
      assert(item.weights.em.style==='italic'&&item.weights.em.synthesis==='style','Markdown italic emphasis lost');
      assert(rendered.shadow.querySelector('style').textContent.length<10000&&!rendered.shadow.querySelector('style').textContent.includes('base64'),'Preview DOM contains font payload');
      if(name==='standard') {
        const face=fonts.faces.get(document), data=fonts.data, ready=fonts.documents.get(document), readCount=fontReads;
        const samples=[];
        for(let i=0;i<4;i++){
          const before=performance.now();
          const next=await plugin.render({...snapshot,text:text.replace('# 林示例','# 林示例 '+i)},plugin,controller.signal);
          samples.push(performance.now()-before);next.dispose();
        }
        result.cache={warmRenderMilliseconds:samples,additionalFileReads:fontReads-readCount,sameDataPromise:fonts.data===data,sameReadyPromise:fonts.documents.get(document)===ready,sameFontFace:fonts.faces.get(document)===face,registeredFaces:Array.from(document.fonts).filter(f=>f.family===FONT_FAMILY).length,previewStyleBytes:rendered.shadow.querySelector('style').textContent.length};
        assert(result.cache.additionalFileReads===0&&result.cache.sameDataPromise&&result.cache.sameReadyPromise&&result.cache.sameFontFace&&result.cache.registeredFaces===1,'Font cache was not reused');
      }
      const html=await exportHtml(rendered,controller.signal);
      assert(html.includes('font-src data:')&&html.includes('data:font/woff2;base64,')&&!html.includes('local("Arial'),'Export font is not embedded');
      const destination=output+'/'+name+'.pdf';
      const printStart=performance.now();
      const bytes=await service.print(html,controller.signal);
      await writePdfAtomically(bytes,destination,controller.signal);
      item.exportMilliseconds=performance.now()-printStart;item.pdf=destination;item.pdfBytes=bytes.length;
      assert(Buffer.from(bytes).subarray(0,5).toString()==='%PDF-','Missing PDF bytes');
      const wc=service.window.webContents;
      item.printDocument=await wc.executeJavaScript(`JSON.stringify({pages:document.querySelectorAll('.cv-page').length,faces:Array.from(document.fonts).map(f=>({family:f.family,weight:f.weight,status:f.status})),weights:['.cv-root','h1','h2','h3','strong'].map(s=>({selector:s,weight:getComputedStyle(document.querySelector(s)).fontWeight})),overflow:Array.from(document.querySelectorAll('.cv-page-content')).map(p=>({x:p.scrollWidth-p.clientWidth,y:p.scrollHeight-p.clientHeight}))})`).then(JSON.parse);
      assert(item.printDocument.pages===item.previewPages&&item.printDocument.faces.some(f=>f.family===FONT_FAMILY&&f.status==='loaded'),'Print font/page mismatch');
      assert(item.printDocument.overflow.every(x=>x.x<=1&&x.y<=1),'Print overflow');
      item.offlineFontSources=true;result.fixtures.push(item);rendered.dispose();rendered=null;save();
    }
    const missing=new ResumeFonts(()=>Promise.reject(Error('Intentionally missing test font')));
    try{await missing.prepare(document,controller.signal);throw Error('Missing font silently succeeded');}
    catch(error){assert(/无法读取|加载失败/.test(error.message),'Missing font did not fail explicitly');result.checks.missingFontFailsExplicitly=true;}
    finally{missing.dispose();}
    try{await service.print('<!doctype html><p>Font deliberately omitted</p>',controller.signal);throw Error('PDF silently used a fallback');}
    catch(error){assert(/思源黑体未加载/.test(error.message),'Unexpected missing-PDF-font outcome: '+error.message);result.checks.pdfRejectsMissingFont=true;}
    const statuses=plugin.views().map(v=>v.contentEl.querySelector('.mcv-status').textContent);
    result.checks.normalMetadataQuiet=statuses.every(s=>/^A4 · [1-9][0-9]* 页$/.test(s));
    result.checks.fontReadCount=fontReads;
    result.status='complete';
  }catch(error){result.status='failed';result.error=String(error.stack??error);}
  finally{
    rendered?.dispose();service.dispose();fonts.read=originalRead;
    const finalLeaves=[];app.workspace.iterateAllLeaves(leaf=>finalLeaves.push(leaf));
    result.safety={nativeEditorsPreserved:editors.every(x=>x.leaf.view.editor===x.editor),nativeBuffersUnchanged:editors.every(x=>x.editor.getValue()===x.text),activeLeafUnchanged:app.workspace.activeLeaf===active,workspaceLeavesUnchanged:initialLeaves.length===finalLeaves.length&&initialLeaves.every(l=>finalLeaves.includes(l)),noVaultFileWrites:true};
    save();
  }
  return JSON.stringify({status:result.status,evidence,output,error:result.error});
})();
