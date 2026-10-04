import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const evidence=path.join(root,'evidence','source-han-font');
await mkdir(evidence,{recursive:true});await mkdir(path.join(root,'tmp'),{recursive:true});
const runId=Date.now().toString(),resultPath=path.join(evidence,`host-${runId}.json`);
const buildBytes=await readFile(path.join(root,'dist/main.js'));
if(!buildBytes.equals(await readFile(path.join(root,'dev-vault/.obsidian/plugins/markdown-to-cv/main.js'))))throw Error('Deploy the current build before this check');
await build({stdin:{contents:'export { exportHtml } from "./src/render"; export { PdfService, writePdfAtomically } from "./src/pdf"; export { ResumeFonts, FONT_FAMILY } from "./src/fonts";',resolveDir:root},bundle:true,platform:'node',format:'cjs',target:'es2022',external:['electron','@electron/remote'],loader:{'.css':'text'},plugins:[{name:'unused-obsidian',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',external:true,sideEffects:false}));}}],outfile:path.join(root,'tmp/font-test-api.cjs')});
const version=execFileSync('obsidian',['vault=dev-vault','version'],{encoding:'utf8'}).trim();
const code=`new Function("app","require","runId","hostVersion",require("fs").readFileSync(${JSON.stringify(path.join(root,'scripts/font-host-suite.js'))},"utf8"))(app,require,${JSON.stringify(runId)},${JSON.stringify(version)})`;
const launch=execFileSync('obsidian',['vault=dev-vault','eval',`code=${code}`],{encoding:'utf8',timeout:10000});
if(launch.includes('Error:'))throw Error(launch);
let finished=false;
for(let i=0;i<120;i++){
  await new Promise(r=>setTimeout(r,500));
  let result;try{result=JSON.parse(await readFile(resultPath,'utf8'));}catch{continue;}
  if(result.status==='running')continue;
  await writeFile(path.join(evidence,'host-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,fixtures:result.fixtures.map(x=>({name:x.name,pages:x.previewPages,pdf:x.pdf})),cache:result.cache,checks:result.checks,safety:result.safety,error:result.error},null,2));
  process.exitCode=result.status==='complete'?0:1;finished=true;break;
}
if(!finished)throw Error(`Font verification timed out; inspect ${resultPath}`);
