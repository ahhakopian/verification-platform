import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,cpSync,mkdirSync,statSync,rmSync,readdirSync} from 'node:fs';import {join,dirname,resolve} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
import {assemble,verify,snapshot,bindingFor} from '../../distribution/package-set.mjs';
import {sha256,resolveResources} from '../../dist/src/resources/resolve.js';
const identity={repository:'https://github.com/test-fixture/verification-platform',tag:'v0.0.1',sourceCommit:'f'.repeat(40)};
test('reproducible coherent distribution relocates independently, offline identity and integrity fail closed',async()=>{
 const temporary=mkdtempSync(join(tmpdir(),'verification-distribution-')),candidate=join(temporary,'candidate'),second=join(temporary,'second');
 assemble(identity,candidate,{fixtureOnly:true});assemble(identity,second,{fixtureOnly:true});
 const bytes=readFileSync(join(candidate,'resource-index.json'));assert.deepEqual(bytes,readFileSync(join(second,'resource-index.json')));const index=JSON.parse(bytes),binding=bindingFor(index,bytes);
 assert.throws(()=>assemble(identity,candidate,{fixtureOnly:true}),/empty/);assert.throws(()=>assemble({...identity,tag:'latest'},join(temporary,'latest'),{fixtureOnly:true}),/immutable/);
 const relocated=join(temporary,'unrelated-location');cpSync(candidate,relocated,{recursive:true});
 // Explicit test-only dependency preparation copies bytes, never symlinks or resolves a development checkout.
 cpSync(resolve('node_modules'),join(relocated,'node_modules'),{recursive:true,dereference:true});
 const pkg=JSON.parse(readFileSync(join(relocated,'package.json')));for(const [name,version] of Object.entries(pkg.dependencies))assert.equal(JSON.parse(readFileSync(join(relocated,'node_modules',name,'package.json'))).version,version);for(const entry of Object.values(pkg.exports))await import(pathToFileURL(join(relocated,entry)).href);
 assert.deepEqual((await import(pathToFileURL(join(relocated,pkg.exports['./runtime'])).href)).descriptors,JSON.parse(readFileSync(join(relocated,'contracts/generic-descriptors.json'))).providers);
 assert.equal(verify(relocated,{binding}).resolved.resources.size,index.resources.length);
 assert(statSync(join(relocated,'dist/runtime/host/wsl-windows/native-ui')).mode&0o111);
 for(const r of index.resources){const content=readFileSync(join(relocated,r.path),'utf8');assert(!content.includes('/home/art/'),r.path);assert(!r.path.includes('slice4-live'));assert(!r.path.includes('import-provenance'));}
 assert(readFileSync(join(relocated,'dist/frontends/browser-verification/SKILL.md'),'utf8').includes('<distribution>/dist/runtime/cdp/extension-action.cjs'));
 assert.equal(index.resources.filter(r=>r.path.endsWith('native-ui.ps1')).length,1);
 for(const frontend of ['browser-verification','verification-orchestrator']){
  const path=join(relocated,'dist/frontends',frontend,'SKILL.md'),content=readFileSync(path,'utf8');for(const link of content.matchAll(/\]\(([^)]+)\)/g))if(!link[1].includes('://')&&!link[1].startsWith('#'))assert.doesNotThrow(()=>statSync(resolve(dirname(path),link[1].split('#')[0])));
 }
 const offline=join(temporary,'offline');snapshot(relocated,offline,binding);assert.deepEqual(readFileSync(join(offline,'resource-index.json')),bytes);verify(offline,{mode:'planning',binding});assert.throws(()=>verify(offline,{binding}));const offlineSummary=join(offline,'contracts/capability-evidence.md'),summaryBytes=readFileSync(offlineSummary);rmSync(offlineSummary);assert.throws(()=>verify(offline,{mode:'planning',binding}));writeFileSync(offlineSummary,summaryBytes);
 const mutation=join(relocated,'contracts/generic-descriptors.json'),original=readFileSync(mutation);writeFileSync(mutation,'mutated');assert.throws(()=>verify(relocated,{binding}),/digest mismatch/);writeFileSync(mutation,original);
 const missing=join(relocated,'dist/runtime/index.js'),saved=readFileSync(missing);rmSync(missing);assert.throws(()=>verify(relocated,{binding}));writeFileSync(missing,saved);
 assert.throws(()=>resolveResources({...binding,sourceCommit:'a'.repeat(40)},{root:relocated,indexPath:'resource-index.json',mode:'execution'}),/Mixed platform identity/);
 const mixed=JSON.parse(bytes);mixed.sourceCommit='a'.repeat(40);writeFileSync(join(relocated,'resource-index.json'),JSON.stringify(mixed));assert.throws(()=>verify(relocated,{binding}),/index digest mismatch/);writeFileSync(join(relocated,'resource-index.json'),bytes);
 const types=join(relocated,'consumer.mts');writeFileSync(types,"import * as runtime from './dist/runtime/index.js'; import {resolveResources} from './dist/src/resources/resolve.js'; import * as compilation from './dist/src/compilation/bundle.js'; void runtime; void resolveResources; void compilation;\n");
 let run=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--skipLibCheck','consumer.mts'],{cwd:relocated,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);
 run=spawnSync('npm',['test'],{cwd:relocated,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr+String(run.error));
 for(const [command,args] of [['python3',['-B',join(relocated,'dist/runtime/host/wsl-windows/browser-session.py'),'--help']],['bash',['-n',join(relocated,'dist/runtime/host/wsl-windows/native-ui')]]]){run=spawnSync(command,args,{cwd:relocated,encoding:'utf8',timeout:10000});assert.equal(run.status,0,run.stdout+run.stderr);}
 const bindingPath=join(temporary,'binding.json');writeFileSync(bindingPath,JSON.stringify(binding));
 for(const prefix of ['asset-a','asset-b']){run=spawnSync(process.execPath,[resolve('distribution/release-dry-run.mjs'),relocated,bindingPath,join(temporary,prefix),'--fixture-only'],{encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);}
 assert.deepEqual(readFileSync(join(temporary,'asset-a.resource-index.json')),bytes);
 assert.equal(sha256(readFileSync(join(temporary,'asset-a.tar.gz'))),sha256(readFileSync(join(temporary,'asset-b.tar.gz'))));
 const unpack=join(temporary,'unpacked');mkdirSync(unpack);run=spawnSync('tar',['-xzf',join(temporary,'asset-a.tar.gz'),'-C',unpack]);assert.equal(run.status,0);verify(unpack,{binding});assert(!readdirSync(unpack).includes('node_modules'));
});
