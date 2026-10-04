import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
function cli(...args) { return execFileSync('obsidian', ['vault=dev-vault',...args], { encoding:'utf8', timeout:10000 }); }
function evaluate(code) {
  const output=cli('eval',`code=${code}`);
  const value=output.trim().replace(/^=>\s*/,'');
  if(!value)throw new Error(`No CLI result for ${code}`);
  return JSON.parse(value);
}
const state=()=>evaluate(`JSON.stringify({vault:app.vault.adapter.getBasePath(),enabled:!!app.plugins.plugins['markdown-to-cv'],views:app.workspace.getLeavesOfType('markdown-to-cv-preview').length,measureNodes:document.querySelectorAll('.mcv-measure').length,exportWindows:require('@electron/remote').BrowserWindow.getAllWindows().filter(w=>!w.isDestroyed()&&w.webContents.getTitle()==='Markdown to CV').length,memory:process.memoryUsage(),status:app.plugins.plugins['markdown-to-cv']?.views()[0]?.contentEl.querySelector('.mcv-status')?.dataset.state})`);
if(state().vault!=='/Users/gbs00/Projects/markdown-to-cv/dev-vault')throw new Error('Wrong vault');
const rounds=[];
for(let i=0;i<3;i++) {
  const before=state(); cli('plugin:disable','id=markdown-to-cv');
  const disabled=state();
  if(disabled.enabled||disabled.views||disabled.measureNodes||disabled.exportWindows)throw new Error(`Unload leak: ${JSON.stringify(disabled)}`);
  cli('plugin:enable','id=markdown-to-cv');cli('open','path=fixtures/01-standard.md');cli('command','id=markdown-to-cv:open-preview');
  let enabled;
  for(let j=0;j<50;j++){await new Promise(r=>setTimeout(r,100));enabled=state();if(enabled.status==='ready')break;}
  if(!enabled.enabled||enabled.views!==1||enabled.status!=='ready')throw new Error(`Enable failed: ${JSON.stringify(enabled)}`);
  rounds.push({round:i+1,before,disabled,enabled});
}
await writeFile('evidence/lifecycle-results.json',JSON.stringify({passed:true,rounds,notes:'Single-renderer process snapshots without GC control; not a steady-state memory budget or 30-minute test.'},null,2)+'\n');
console.log('Passed 3 disable/enable cycles; zero preview/measurement/PDF windows after disable.');
