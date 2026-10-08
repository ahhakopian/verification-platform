import {readFileSync,writeFileSync,cpSync,mkdirSync,readdirSync,existsSync,statSync,chmodSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {sha256,resolveResources} from '../dist/src/resources/resolve.js';
import {validateSchema} from '../dist/src/validation/schema.js';
import {publicEntries,requiredExecutionResources} from '../dist/src/resources/inventory.js';
export const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
export const bindingFor=(index,bytes)=>({schemaVersion:1,repository:index.repository,tag:index.tag,sourceCommit:index.sourceCommit,index:{asset:'resource-index.json',sha256:sha256(bytes)},resources:{integration:'contracts/verification-integration.md',planSchema:'schemas/browser-verification-plan.schema.json',descriptors:'contracts/generic-descriptors.json'}});
export function assemble(identity,output,{fixtureOnly=false}={}){
 const probe={schemaVersion:1,...identity,resources:[{id:'probe',path:'probe',sha256:'0'.repeat(64),formatVersion:1,kind:'normative',dependencies:[]}]};
 if(validateSchema('resource-index',probe).length)throw Error('Exact immutable repository/tag/commit required; synthetic identities only with fixture-only');
 if(existsSync(output)&&readdirSync(output).length)throw Error('Candidate destination must be empty; immutable assets are not overwritten');
 if(!fixtureOnly){
  const git=(...args)=>execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  let commit,repository;try{commit=git('rev-parse','HEAD');repository=git('remote','get-url','origin');}catch{throw Error('Canonical repository/source commit cannot be established; fixture-only is for tests');}
  repository=repository.replace(/^git@github\.com:/,'https://github.com/').replace(/\.git$/,'').replace(/\/$/,'');
  if(commit!==identity.sourceCommit||repository!==identity.repository||git('status','--porcelain','--','.'))throw Error('Release identity does not match clean canonical platform source');
  if(JSON.parse(readFileSync(join(sourceRoot,'contracts/generic-descriptors.json'))).providers.some(p=>p.version!==identity.tag))throw Error('Generic provider identities are not prepared for this exact platform release');
 }
 mkdirSync(output,{recursive:true});const resources=[];
 const add=(path,kind)=>{const src=join(sourceRoot,path),dst=join(output,path);mkdirSync(dirname(dst),{recursive:true});cpSync(src,dst);if(path.endsWith('/native-ui'))chmodSync(dst,0o755);resources.push({id:path,path,sha256:sha256(readFileSync(dst)),formatVersion:1,kind,dependencies:path==='contracts/verification-integration.md'?['contracts/contracts.md']:path==='contracts/generic-descriptors.json'?['contracts/unavailable-capabilities.json','contracts/capability-evidence.md']:[],...(publicEntries[path]?{entry:publicEntries[path]}:{})});};
 const visit=(dir,kind)=>{for(const e of readdirSync(join(sourceRoot,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const path=join(dir,e.name);if(e.isDirectory())visit(path,kind);else if(!path.startsWith('dist/tests/')&&!path.includes('__pycache__')&&!path.endsWith('.pyc'))add(path,path.includes('frontends/')?'frontend':kind);}};
 for(const folder of ['contracts','schemas'])visit(folder,'normative');visit('dist','runtime');
 for(const expected of requiredExecutionResources)if(!resources.some(r=>r.id===expected.id))throw Error('Built distribution entry/asset missing: '+expected.id);
 for(const path of ['package.json','package-lock.json','distribution/README.md','distribution/RELEASE.md','distribution/smoke.mjs','tests/fixtures/ordinary.spec.ts','tests/fixtures/ordinary.config.mjs','tests/fixtures/execution.mjs','tests/fixtures/plan.json'])add(path,'runtime');
 const fixturePath=join(output,'tests/fixtures/ordinary.spec.ts');writeFileSync(fixturePath,readFileSync(fixturePath,'utf8').replaceAll('../../runtime/','../../dist/runtime/').replaceAll('../../src/','../../dist/src/'));resources.find(r=>r.id==='tests/fixtures/ordinary.spec.ts').sha256=sha256(readFileSync(fixturePath));
 const packaged=JSON.parse(readFileSync(join(output,'package.json')));packaged.scripts={test:'node distribution/smoke.mjs'};packaged.description='Single pinned Verification Platform distribution; source and release identity are resource-index.json';writeFileSync(join(output,'package.json'),JSON.stringify(packaged,null,2)+'\n');resources.find(r=>r.id==='package.json').sha256=sha256(readFileSync(join(output,'package.json')));
 resources.sort((a,b)=>a.id.localeCompare(b.id,'en'));
 writeFileSync(join(output,'resource-index.json'),JSON.stringify({schemaVersion:1,...identity,resources},null,2)+'\n');
 verify(output);return {candidate:output,indexDigest:sha256(readFileSync(join(output,'resource-index.json'))),resources:resources.length,sourceVerified:!fixtureOnly,fixtureOnly,published:false};
}
export function verify(root,{mode='execution',binding}={}){
 const bytes=readFileSync(join(root,'resource-index.json')),index=JSON.parse(bytes);binding??=bindingFor(index,bytes);
 const resolved=resolveResources(binding,{root,indexPath:'resource-index.json',mode});
 // A normative snapshot includes every normative resource, not just the binding's dependency closure.
 if(mode==='planning')for(const r of index.resources.filter(r=>r.kind==='normative')){if(sha256(readFileSync(join(root,r.path)))!==r.sha256)throw Error('Resource digest mismatch: '+r.id);}
 if(mode==='execution'&&!(statSync(join(root,'dist/runtime/host/wsl-windows/native-ui')).mode&0o111))throw Error('Required native compatibility executable mode missing');
 return {binding,index,resolved};
}
export function snapshot(root,output,binding){
 const {index}=verify(root,{binding});if(existsSync(output)&&readdirSync(output).length)throw Error('Snapshot destination must be empty');mkdirSync(output,{recursive:true});cpSync(join(root,'resource-index.json'),join(output,'resource-index.json'));
 for(const r of index.resources.filter(r=>r.kind==='normative')){mkdirSync(dirname(join(output,r.path)),{recursive:true});cpSync(join(root,r.path),join(output,r.path));}verify(output,{mode:'planning',binding});return output;
}
