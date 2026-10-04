return (async () => {
  const fs=require('fs'),path=require('path');
  const root='/Users/gbs00/Projects/markdown-to-cv';
  if(app.vault.adapter.getBasePath()!==root+'/dev-vault')throw Error('Refusing non-development Vault');
  const module={exports:{}};
  new Function('module','exports','require',fs.readFileSync(root+'/tmp/photo-test-api.cjs','utf8'))(module,module.exports,require);
  const {exportHtml,PdfService,writePdfAtomically}=module.exports;
  const plugin=app.plugins.plugins['markdown-to-cv'];
  const folder='qa-runtime/photo-'+runId,output=root+'/output/pdf/photo-'+runId;
  const evidence=root+'/evidence/photo/host-'+runId+'.json';
  const result={status:'running',fixtures:[],checks:{},method:'Offscreen production renderer, synthetic local images and isolated PDF service; no note or editor writes'};
  const save=()=>fs.writeFileSync(evidence,JSON.stringify(result,null,2));
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const editors=app.workspace.getLeavesOfType('markdown').map(leaf=>({leaf,editor:leaf.view.editor,text:leaf.view.editor?.getValue()}));
  const active=app.workspace.activeLeaf,leaves=[];app.workspace.iterateAllLeaves(leaf=>leaves.push(leaf));
  const controller=new AbortController(),service=new PdfService();
  let rendered=null,testFolder;
  const base=fs.readFileSync(root+'/fixtures/01-standard.md','utf8');
  const withPhoto=(text,value)=>text.replace(/^(# .+)$/m,'$1\n\n**照片：** '+value);
  const snapshot=text=>({path:folder+'/resume.md',name:'虚构照片验收',text,capturedAt:Date.now()});
  const render=async text=>plugin.render(snapshot(text),plugin,controller.signal);
  const pageText=r=>Array.from(r.pages.querySelectorAll('.cv-page-content')).map(el=>el.textContent);
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  save();
  try{
    testFolder=await app.vault.createFolder(folder);
    await app.vault.createFolder(folder+'/assets');
    fs.mkdirSync(output,{recursive:true});
    for(const [from,to] of [['photo-portrait.png','portrait.png'],['photo-landscape.jpg','photo landscape (1).jpg'],['photo-square.webp','square.webp'],['resource.svg','body.svg']]){
      const bytes=fs.readFileSync(root+'/fixtures/assets/'+from);
      await app.vault.createBinary(folder+'/assets/'+to,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    }
    await app.vault.createBinary(folder+'/assets/corrupt.png',new TextEncoder().encode('not an image').buffer);
    const original=await render(base),blank=await render(withPhoto(base,''));
    assert(original.pages.innerHTML===blank.pages.innerHTML,'Blank photo changed existing layout');
    result.checks.emptyFieldPreservesLayout=true;original.dispose();blank.dispose();
    const variants=[
      {name:'portrait',text:withPhoto(base,'![[assets/portrait.png|500x10]]')},
      {name:'landscape',text:withPhoto(base,'![照片](<assets/photo landscape (1).jpg>)')},
      {name:'square',text:withPhoto(base,'\n\n![[assets/square.webp]]')},
      {name:'long-header',text:withPhoto(fs.readFileSync(root+'/fixtures/04-pagination.md','utf8'),'![[assets/portrait.png]]').replace(/^# .+$/m,'# 林示例 · Alexandra Example-With-A-Long-Name').replace(/\*\*求职方向：\*\*.*/, '**求职方向：** 跨平台产品工程师 / Product Engineer for Developer Tools and Knowledge Systems')+'\n\n## 作品附件\n\n![正文图片](assets/body.svg)\n'}
    ];
    for(const variant of variants){
      rendered=await render(variant.text);
      assert(!rendered.issues.some(i=>i.blocksExport),variant.name+': '+JSON.stringify(rendered.issues));
      const header=rendered.pages.querySelector('.cv-profile'),img=header?.querySelector('img'),details=header?.querySelector('.cv-profile-details');
      assert(img&&details,'Photo header missing: '+variant.name);
      const photoRect=rect(img),textRect=rect(details),headerRect=rect(header);
      assert(photoRect.width<=28*96/25.4+0.2&&photoRect.height<=36*96/25.4+0.2,'Photo exceeds maximum size');
      assert(Math.abs(photoRect.width/photoRect.height-img.naturalWidth/img.naturalHeight)<0.01,'Photo distorted');
      assert(textRect.right+10<photoRect.left&&Math.abs(textRect.top-photoRect.top)<0.2,'Photo/text overlap or top alignment');
      assert(header.closest('.cv-page')===rendered.pages.firstElementChild,'Header split away from first page');
      assert(rendered.pages.querySelectorAll('.cv-profile').length===1,'Header repeated on multiple pages');
      assert(Array.from(details.querySelectorAll('*')).every(el=>el.getBoundingClientRect().right<=textRect.right+1),'Long header text overflow');
      const item={name:variant.name,pages:rendered.pageCount,text:pageText(rendered),photoRect,textRect,headerRect,natural:{width:img.naturalWidth,height:img.naturalHeight},photoPath:rendered.photoPath};
      if(variant.name==='long-header')assert(rendered.pages.querySelectorAll('img').length===2&&rendered.pageCount>=2,'Body image or pagination lost');
      const html=await exportHtml(rendered,controller.signal);
      assert(!html.includes('src="app://'),'PDF contains unresolved local resource');
      item.pdf=output+'/'+variant.name+'.pdf';
      await writePdfAtomically(await service.print(html,controller.signal),item.pdf,controller.signal);
      item.print=JSON.parse(await service.window.webContents.executeJavaScript(`JSON.stringify({pages:document.querySelectorAll('.cv-page').length,images:Array.from(document.images).map(i=>({loaded:i.complete&&i.naturalWidth>0,embedded:i.src.startsWith('data:'),width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height})),overflow:Array.from(document.querySelectorAll('.cv-page-content')).map(p=>({x:p.scrollWidth-p.clientWidth,y:p.scrollHeight-p.clientHeight}))})`));
      assert(item.print.pages===item.pages&&item.print.images.every(i=>i.loaded&&i.embedded),'PDF image/page mismatch');
      assert(item.print.overflow.every(p=>p.x<=1&&p.y<=1),'PDF page overflow');
      assert(Math.abs(item.print.images[0].width-photoRect.width)<0.2&&Math.abs(item.print.images[0].height-photoRect.height)<0.2,'Preview/PDF photo size mismatch');
      result.fixtures.push(item);rendered.dispose();rendered=null;save();
    }
    rendered=await render(withPhoto(base,'![照片](assets/photo%20landscape%20%281%29.jpg)'));
    assert(rendered.pages.querySelector('.cv-profile img')&&!rendered.issues.some(i=>i.blocksExport),'Encoded local path failed: '+JSON.stringify(rendered.issues));
    rendered.dispose();rendered=null;result.checks.encodedPaths=true;
    for(const [name,value] of [['missing','![[assets/missing.png]]'],['corrupt','![[assets/corrupt.png]]'],['remote','![照片](https://example.invalid/portrait.jpg)'],['invalid','照片说明文字'],['duplicate','![[assets/portrait.png]]\n\n**照片：** ![[assets/square.webp]]']]){
      rendered=await render(withPhoto(base,value));
      assert(rendered.issues.some(i=>i.blocksExport),'Bad photo did not block export: '+name);
      assert(!rendered.pages.querySelector('.cv-profile'),'Bad photo leaves reserved space: '+name);
      assert(pageText(rendered).join('').includes('星屿示例科技'),'Body lost after photo failure: '+name);
      let blocked=false;try{await exportHtml(rendered,controller.signal);}catch(e){blocked=/照片/.test(e.message);}
      assert(blocked,'Invalid photo PDF was allowed: '+name);
      result.checks[name+'KeepsBodyAndBlocksExport']=true;rendered.dispose();rendered=null;
    }
    const originalViews=plugin.views;let scheduled=0;
    const file=app.vault.getAbstractFileByPath(folder+'/assets/portrait.png');
    try{
      plugin.views=()=>[{source:null,current:{photoPath:file.path},schedule:()=>scheduled++}];
      app.vault.trigger('modify',file);app.vault.trigger('rename',file,file.path);app.vault.trigger('delete',file);
      assert(scheduled===3,'Photo attachment changes do not invalidate preview');
      result.checks.photoAttachmentEventsRefresh=true;
    }finally{plugin.views=originalViews;}
    result.status='complete';
  }catch(error){result.status='failed';result.error=String(error.stack??error);}
  finally{
    rendered?.dispose();service.dispose();
    if(testFolder)await app.vault.delete(testFolder,true);
    const after=[];app.workspace.iterateAllLeaves(leaf=>after.push(leaf));
    result.safety={nativeEditorsPreserved:editors.every(i=>i.leaf.view.editor===i.editor),nativeBuffersUnchanged:editors.every(i=>i.editor?.getValue()===i.text),activeLeafUnchanged:app.workspace.activeLeaf===active,workspaceLeavesUnchanged:after.length===leaves.length&&leaves.every(l=>after.includes(l)),syntheticAssetsRemoved:!app.vault.getAbstractFileByPath(folder),noNoteWrites:true};
    save();
  }
  return JSON.stringify({status:result.status,evidence,error:result.error});
})();
