import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,cpSync} from 'node:fs';import {join} from 'node:path';
import {currentResultFixture} from '../fixtures/current-result.mjs';
import {invokePlaywright} from '../../dist/runtime/invoke.js';
test('crash collection ignores Playwright attachment copies and preserves decisive contradiction',async()=>{
 const f=currentResultFixture(),root=f.projectRoot,output=join(root,'output'),copied=join(output,'attachments');mkdirSync(copied,{recursive:true});
 const evidence=structuredClone(f.evidence[0]);evidence.attachment.path=join(root,'raw.json');
 // Keep attachments inside the assigned output scope.
 cpSync(join(root,'raw.json'),join(output,'raw.json'));evidence.attachment.path=join(output,'raw.json');
 const record={...f.records[0],outcome:'contradicted',reason:'Decisive current fixture contradiction'};
 for(const [name,value] of [['evidence-original.json',evidence],['claim-original.json',record]]){writeFileSync(join(output,name),JSON.stringify(value));cpSync(join(output,name),join(copied,name));}
 writeFileSync(join(root,'runner.mjs'),'process.exitCode=1;');
 const returned=await invokePlaywright({plan:JSON.parse(f.planBytes),assignment:f.assignment,manifest:f.manifest,identity:f.manifest.identity,outputRoot:output,cwd:root,resultPath:join(root,'crash-result.json'),runnerEntry:join(root,'runner.mjs'),config:'unused'});
 assert.equal(returned.result.verdict,'FAIL');assert.equal(returned.result.runner.status,'incomplete-collection');assert.equal(returned.runnerExitCode,1);assert.equal(returned.acceptanceExitCode,1);
 assert.deepEqual(returned.result.claims[0].evidenceIds,['version-evidence']);assert(!returned.result.limitations.some(x=>x.includes('Rejected evidence identity/format')));
});

test('crash finalizer consumes flushed preflight blockers once and persists NOT RUN claims',async()=>{
 const {PreflightRecorder}=await import('../../dist/runtime/evidence/readiness.js');
 const f=currentResultFixture(),root=f.projectRoot,output=join(root,'output');mkdirSync(output,{recursive:true});
 const recorder=new PreflightRecorder(output,f.manifest.identity,'assigned-chrome',0);
 await recorder.blocked('browser','Configured browser unavailable');
 mkdirSync(join(output,'attachments'));for(const file of (await import('node:fs')).readdirSync(output).filter(p=>p.startsWith('preflight-')))cpSync(join(output,file),join(output,'attachments',file));
 writeFileSync(join(root,'runner.mjs'),'process.exitCode=1;');
 const result=await invokePlaywright({plan:JSON.parse(f.planBytes),assignment:f.assignment,manifest:f.manifest,identity:f.manifest.identity,outputRoot:output,cwd:root,resultPath:join(root,'crash-result.json'),runnerEntry:join(root,'runner.mjs'),config:'unused'});
 assert.equal(result.result.verdict,'BLOCKED');assert.equal(result.result.runner.status,'incomplete-collection');assert.equal(result.runnerExitCode,1);assert.match(result.result.claims[0].reason,/NOT RUN/);assert.deepEqual(result.result.claims[0].evidenceIds,[]);
 const fs=await import('node:fs');const claims=fs.readdirSync(output).filter(p=>p.startsWith('claim-readiness-')).map(p=>JSON.parse(fs.readFileSync(join(output,p))));assert.equal(claims.length,1);assert.equal(claims[0].attempted,false);
});
test('preflight READY without product records cannot pass crash finalization',async()=>{
 const {PreflightRecorder}=await import('../../dist/runtime/evidence/readiness.js');
 const f=currentResultFixture(),root=f.projectRoot,output=join(root,'output');mkdirSync(output,{recursive:true});
 const recorder=new PreflightRecorder(output,f.manifest.identity,'assigned-chrome',0);
 for(const [stage,status] of [['browser','PASS'],['project','PASS'],['target','PASS'],['gate','ENVIRONMENT READY']])await recorder.append({stage,status,reason:'Fixture readiness',observations:{},evidence:[],cleanupErrors:[]});
 writeFileSync(join(root,'runner.mjs'),'process.exitCode=0;');
 const returned=await invokePlaywright({plan:JSON.parse(f.planBytes),assignment:f.assignment,manifest:f.manifest,identity:f.manifest.identity,outputRoot:output,cwd:root,resultPath:join(root,'crash-result.json'),runnerEntry:join(root,'runner.mjs'),config:'unused'});
 assert.equal(returned.result.verdict,'INCONCLUSIVE');assert.equal(returned.acceptanceExitCode,1);assert.equal(returned.result.counts.FAIL,0);assert.equal(returned.result.counts.PASS,0);
});
