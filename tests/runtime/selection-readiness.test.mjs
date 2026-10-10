import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {assignedPageReady} from '../../dist/runtime/fixtures.js';
import Reporter from '../../dist/runtime/reporter.js';
import {plan,assignment,identity,manifest} from '../fixtures/execution.mjs';
import {reconcile} from '../../dist/runtime/evidence/reconcile.js';
import {recordReadinessFailure} from '../../dist/runtime/evidence/readiness.js';
test('selection readiness is test scoped, identity mapped and does not infer missing annotations',async()=>{
 const attachments=[],info={annotations:[{type:'testKey',description:'version-key'}],attach:async(name,value)=>attachments.push({name,...value})};
 const browser={contexts:()=>[{pages:()=>[]}]};
 await assert.rejects(assignedPageReady(browser,'https://fixture.invalid',identity,info),/match exactly once/);
 assert.equal(attachments.length,1);
 const directory=mkdtempSync(join(tmpdir(),'verification-selection-')),resultPath=join(directory,'result.json');
 const reporter=new Reporter({plan,assignment,identity,manifest,resultPath,outputRoot:directory});
 reporter.onTestEnd({annotations:info.annotations,title:'version',location:{file:resolve('reference.spec.ts')}},{attachments,workerIndex:0,errors:[]});
 reporter.onEnd({status:'failed'});const result=JSON.parse(readFileSync(resultPath));assert.equal(result.verdict,'BLOCKED');
 const records=readdirSync(directory).filter(p=>p.startsWith('claim-readiness-')).map(p=>JSON.parse(readFileSync(join(directory,p))));assert.equal(records.length,1);
 assert.deepEqual(reconcile({plan,assignment,identity,manifest,evidence:[],records,outputRoot:directory,runner:result.runner,limitations:result.limitations}),result);
 const absent=[];await assert.rejects(assignedPageReady(browser,'https://fixture.invalid',identity,{annotations:[],attach:async value=>absent.push(value)}));assert.equal(absent.length,0);
 const page={url:()=> 'https://fixture.invalid'};assert.equal(await assignedPageReady({contexts:()=>[{pages:()=>[page]}]},page.url(),identity,info),page);assert.equal(attachments.length,1);
});
test('worker readiness mapping persists the same current records for result consumption',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'verification-worker-readiness-')),resultPath=join(directory,'result.json');
 await recordReadinessFailure(directory,identity,3,'host:session',{toString:()=> 'explicit readiness boundary'});
 const reporter=new Reporter({plan,assignment,identity,manifest,resultPath,outputRoot:directory});
 reporter.onTestEnd({annotations:[{type:'testKey',description:'version-key'}],title:'version',location:{file:resolve('reference.spec.ts')}},{attachments:[],workerIndex:3,errors:[]});reporter.onEnd({status:'failed'});
 const result=JSON.parse(readFileSync(resultPath)),records=readdirSync(directory).filter(p=>p.startsWith('claim-readiness-')).map(p=>JSON.parse(readFileSync(join(directory,p))));
 assert.equal(records.length,1);assert.equal(records[0].attempted,false);assert.equal(records[0].errors[0].phase,'readiness');assert.equal(result.verdict,'BLOCKED');
 assert.deepEqual(reconcile({plan,assignment,identity,manifest,evidence:[],records,outputRoot:directory,runner:result.runner,limitations:result.limitations}),result);
});

test('preflight blocker records remain separate and map unattempted product claims without changing runner status',async()=>{
 const {PreflightRecorder}=await import('../../dist/runtime/evidence/readiness.js');
 const directory=mkdtempSync(join(tmpdir(),'verification-preflight-reporter-')),resultPath=join(directory,'result.json');
 const recorder=new PreflightRecorder(directory,identity,'assigned-chrome',0);
 await recorder.blocked('browser','Known host escalation required');
 const reporter=new Reporter({plan,assignment,identity,manifest,resultPath,outputRoot:directory});
 reporter.onTestEnd({annotations:[{type:'testKey',description:'version-key'}],title:'version',location:{file:resolve('reference.spec.ts')}},{attachments:[{name:'preflight',contentType:'application/json',body:Buffer.from(JSON.stringify(recorder.records))}],workerIndex:0,errors:[]});
 reporter.onEnd({status:'failed'});
 const result=JSON.parse(readFileSync(resultPath));assert.equal(result.verdict,'BLOCKED');assert.equal(result.runner.status,'failed');assert.deepEqual(result.claims[0].evidenceIds,[]);
 assert.match(result.claims[0].reason,/proof: NOT RUN/);
 const records=readdirSync(directory).filter(p=>p.startsWith('claim-readiness-')).map(p=>JSON.parse(readFileSync(join(directory,p))));
 assert.equal(records.length,1);assert.equal(records[0].attempted,false);assert.equal(records[0].outcome,'blocked');assert.deepEqual(records[0].assertions,[]);
 assert.deepEqual(reconcile({plan,assignment,identity,manifest,evidence:[],records,outputRoot:directory,runner:result.runner,limitations:result.limitations}),result);
});
test('READY preflight alone never creates a product PASS or FAIL',async()=>{
 const {PreflightRecorder}=await import('../../dist/runtime/evidence/readiness.js');
 const directory=mkdtempSync(join(tmpdir(),'verification-preflight-ready-')),resultPath=join(directory,'result.json');
 const recorder=new PreflightRecorder(directory,identity,'assigned-chrome',0);
 for(const [stage,status] of [['browser','PASS'],['project','PASS'],['target','PASS'],['gate','ENVIRONMENT READY']])await recorder.append({stage,status,reason:'Established fixture setup',observations:{},evidence:[],cleanupErrors:[],...(stage==='target'||stage==='gate'?{testKey:'version-key'}:{})});
 const reporter=new Reporter({plan,assignment,identity,manifest,resultPath,outputRoot:directory});reporter.onEnd({status:'passed'});
 const result=JSON.parse(readFileSync(resultPath));assert.equal(result.verdict,'INCONCLUSIVE');assert.equal(result.counts.PASS,0);assert.equal(result.counts.FAIL,0);
 assert.equal(readdirSync(directory).filter(p=>p.startsWith('claim-readiness-')).length,0);
});
