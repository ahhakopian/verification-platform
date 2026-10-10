import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {chromium} from '@playwright/test';
import {browserPreflight,projectPreflight,targetPreflight,environmentReady,PreflightRecorder} from '../../dist/runtime/preflight.js';
import {collectPreflight} from '../../dist/runtime/evidence/readiness.js';
import {sha256} from '../../dist/src/resources/resolve.js';
import {plan,assignment,identity} from '../fixtures/execution.mjs';

function fixture(present=true){
 const root=mkdtempSync(join(tmpdir(),'verification-preflight-')),events=[];
 const assigned=structuredClone(assignment),normative=structuredClone(plan);
 assigned.authorization.allowedEffects=['target-create','target-navigate'];assigned.ownership.disposable=['target'];assigned.ownership.cleanup=[];normative.claims[0].allowedEffects=[...assigned.authorization.allowedEffects];
 const planBytes=JSON.stringify(normative),currentIdentity={...structuredClone(identity),planDigest:sha256(planBytes)};
 assigned.planDigest=currentIdentity.planDigest;assigned.authorization.planDigest=currentIdentity.planDigest;currentIdentity.assignmentDigest=sha256(JSON.stringify(assigned));
 const recorder=new PreflightRecorder(root,currentIdentity,'assigned-chrome',0);
 const pages=[];let nextId=0;
 const browser={isConnected:()=>true,contexts:()=>[context]};
 const context={browser:()=>browser,pages:()=>pages,newPage:async()=>{events.push('create');return makePage('about:blank');},newCDPSession:async page=>({send:async()=>({targetInfo:{targetId:page.id,type:'page',url:page.url()}}),detach:async()=>events.push('detach')})};
 function makePage(url){let closed=false,current=url;const page={id:'target-'+nextId++,url:()=>current,isClosed:()=>closed,context:()=>context,goto:async value=>{events.push('navigate');current=value;},waitForLoadState:async state=>{assert.equal(state,'domcontentloaded');events.push('load');},close:async()=>{closed=true;events.push('close');}};pages.push(page);return page;}
 if(present)makePage(assigned.environments[0].selection.pageUrl);
 const provenance={binary:'C:\\fixture\\chrome.exe',profile:'C:\\fixture\\profile',version:'123.4.5.6',process_id:123,started_at:'start',webSocketDebuggerUrl:'ws://127.0.0.1:9317/devtools/browser/current'};
 const session={endpoint:'ws://127.0.0.1:1111/devtools/browser/current',provenance,revalidate:async()=>events.push('revalidate'),dispose:async()=>events.push('dispose')};
 const environment={browser,session,provenance};
 const options={pageUrl:assigned.environments[0].selection.pageUrl,deadlineMs:1000,assignment:assigned,planBytes,claimIds:['browser-version'],testKey:'version-key'};
 return {root,events,recorder,assigned,normative,browser,context,pages,makePage,provenance,session,environment,options};
}
async function browserStage(f){await f.recorder.append({stage:'browser',status:'PASS',reason:'Current fixture attachment',observations:{...f.provenance},evidence:[],cleanupErrors:[]});}
async function setupTarget(f){await browserStage(f);await projectPreflight(f.environment,f.recorder,f.root);}
async function readyTarget(environment,recorder,options){const target=await targetPreflight(environment,recorder,options);await environmentReady(environment,target,recorder,options);return target;}
function hook(f,body,referenceChanges={}){
 const entry='hook.mjs';writeFileSync(join(f.root,entry),body);
 return {contractVersion:1,entry,sha256:sha256(readFileSync(join(f.root,entry))),deadlineMs:1000,input:{expected:'fixture-build'},...referenceChanges};
}
const readyHook=`import {writeFileSync} from 'node:fs'; import {join} from 'node:path'; import {createHash} from 'node:crypto';
export const contractVersion=1;
export async function runPreflight(c){
 if(c.contractVersion!==1||c.input.expected!=='fixture-build'||!c.browser.isConnected())throw Error('Wrong deterministic context');
 const path=join(c.evidenceDirectory,'ready.json'),bytes=JSON.stringify({observed:'fixture-build'});writeFileSync(path,bytes);
 return {contractVersion:1,status:'READY',reason:'Expected fixture build observed',evidence:[{path,sha256:createHash('sha256').update(bytes).digest('hex')}]};
}`;
function mockHost(t,f,launch,stopped=false){
 const calls=[];
 const mock=t.mock.method(childProcess,'spawn',(_command,args)=>{
  calls.push(args);const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.exitCode=null;
  c.kill=()=>{queueMicrotask(()=>{c.exitCode=0;c.emit('close',0);});return true;};
  queueMicrotask(()=>{
   if(args[0]==='-c'){c.stdout.write(JSON.stringify(f.provenance));c.exitCode=0;c.emit('close',0);}
   else if(stopped&&!args.includes('--launch')){c.stdout.write(JSON.stringify({status:'BLOCKED',detail:'Debugging listener is absent'}));c.exitCode=1;c.emit('close',1);}
   else c.stdout.write(JSON.stringify({status:'ok',...f.provenance,launched:launch,cdp_endpoint:f.session.endpoint})+'\n');
  });return c;
 });syncBuiltinESMExports();t.after(()=>{mock.mock.restore();syncBuiltinESMExports();});
 t.mock.method(chromium,'connectOverCDP',async endpoint=>{assert.equal(endpoint,f.session.endpoint);f.events.push('attach');return f.browser;});
 return calls;
}
const config={runtimeConfig:'runtime.json',powershell:'fixture',launch:true,readinessMs:1000,disposalMs:20};
for(const [name,present,launched] of [['running + target present',true,false],['running + target absent',false,false],['stopped + target absent',false,true]])test('stage order and convergence: '+name,async t=>{
 const f=fixture(present),calls=mockHost(t,f,launched);
 const environment=await browserPreflight(config,f.recorder);await projectPreflight(environment,f.recorder,f.root);
 const target=await readyTarget(environment,f.recorder,f.options);
 assert.deepEqual(f.recorder.records.map(r=>r.stage),['browser','project','target','gate']);
 assert.deepEqual(f.recorder.records.map(r=>r.status),[launched?'RECOVERED':'PASS','PASS',present?'PASS':'CREATED','ENVIRONMENT READY']);
 assert.equal(f.recorder.records[0].observations.launched,launched);assert(calls[0].includes('--launch'));
 assert.equal(target.page,f.pages.at(-1));assert.equal(f.events.includes('create'),!present);
 const records=collectPreflight(f.root,f.recorder.identity);assert.deepEqual(records.errors,[]);assert.equal(records.records.length,4);
 assert.deepEqual(f.assigned.ownership.cleanup,[]);
 await target.dispose();assert.equal(target.page.isClosed(),false);await environment.session.dispose();
});
test('forbidden launch is blocked without switching browser or changing launch authorization',async t=>{
 const f=fixture(false),calls=mockHost(t,f,false,true);
 await assert.rejects(browserPreflight({...config,launch:false},f.recorder),/launch is not authorized/);
 assert(!calls[0].includes('--launch'));assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');assert(!f.events.includes('attach'));
});
test('hook absent is an explicit PASS and no project hook is imported',async()=>{const f=fixture();await browserStage(f);await projectPreflight(f.environment,f.recorder,f.root);assert.equal(f.recorder.records[1].reason,'No project hook configured');});
test('hook READY validates context, entry and persisted evidence',async()=>{const f=fixture();await browserStage(f);const reference=hook(f,readyHook);await projectPreflight(f.environment,f.recorder,f.root,reference);const record=f.recorder.records[1];assert.equal(record.status,'PASS');assert.equal(record.observations.hook.sha256,reference.sha256);assert.equal(record.evidence.length,1);assert.deepEqual(collectPreflight(f.root,f.recorder.identity).errors,[]);});
for(const status of ['NEEDS_HITL','BLOCKED'])test('hook '+status+' stops target/proof and preserves the structured request',async()=>{
 const f=fixture(false);await browserStage(f);
 const reference=hook(f,`export const contractVersion=1;export async function runPreflight(){return ${JSON.stringify({contractVersion:1,status,reason:'Required project state unavailable',evidence:[],...(status==='NEEDS_HITL'?{hitl:{action:'Reload expected extension',reason:'Persistent change'}}:{})})}}`);
 await assert.rejects(projectPreflight(f.environment,f.recorder,f.root,reference),new RegExp(status));
 assert.equal(f.recorder.records[1].observations.hook.status,status);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');assert(!f.events.includes('create'));
});
for(const [name,source,changes,pattern] of [
 ['reference version',readyHook,{contractVersion:2},/reference/],
 ['digest',readyHook,{sha256:'0'.repeat(64)},/digest mismatch/],
 ['module version','export const contractVersion=2;export async function runPreflight(){}',{},/module version/],
 ['invalid result','export const contractVersion=1;export async function runPreflight(){return {contractVersion:1,status:"READY",reason:"ready",evidence:[]}}',{},/requires readiness evidence/],
 ['deadline','export const contractVersion=1;export async function runPreflight(){await new Promise(r=>setTimeout(r,100));return {contractVersion:1,status:"READY",reason:"late",evidence:[]}}',{deadlineMs:5},/deadline/],
 ['evidence path','export const contractVersion=1;export async function runPreflight(c){return {contractVersion:1,status:"READY",reason:"ready",evidence:[{path:c.projectRoot+"/hook.mjs",sha256:"'+'0'.repeat(64)+'"}]}}',{},/outside assigned/],
 ['evidence digest',readyHook.replace("createHash('sha256').update(bytes).digest('hex')","'"+'0'.repeat(64)+"'"),{},/digest mismatch/]
])test('hook blocks '+name,async()=>{const f=fixture();await browserStage(f);await assert.rejects(projectPreflight(f.environment,f.recorder,f.root,hook(f,source,changes)),pattern);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');});
test('hook cancellation never promotes late results',async()=>{
 const f=fixture();await browserStage(f);const abort=new AbortController();abort.abort();
 await assert.rejects(projectPreflight(f.environment,f.recorder,f.root,hook(f,readyHook),abort.signal),/cancelled/);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');
});
for(const effect of ['target-create','target-navigate'])test('target requires authorization: '+effect,async()=>{const f=fixture(false);f.assigned.authorization.allowedEffects=f.assigned.authorization.allowedEffects.filter(e=>e!==effect);f.recorder.identity.assignmentDigest=sha256(JSON.stringify(f.assigned));await setupTarget(f);await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/not authorized/);assert(!f.events.includes('create'));});
test('target effects cannot expand normative claim permission or disposable ownership',async()=>{
 for(const missing of ['normative','ownership']){const f=fixture(false);if(missing==='normative'){f.normative.claims[0].allowedEffects=[];f.options.planBytes=JSON.stringify(f.normative);f.recorder.identity.planDigest=sha256(f.options.planBytes);f.assigned.planDigest=f.recorder.identity.planDigest;f.assigned.authorization.planDigest=f.recorder.identity.planDigest;}else f.assigned.ownership.disposable=[];f.recorder.identity.assignmentDigest=sha256(JSON.stringify(f.assigned));await setupTarget(f);await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/authorized|disposable/);assert(!f.events.includes('create'));}
});
test('exact reuse neither reloads nor closes a borrowed page',async()=>{const f=fixture();await setupTarget(f);const ready=await readyTarget(f.environment,f.recorder,f.options);await ready.dispose();assert.equal(ready.page,f.pages[0]);assert(!f.events.includes('navigate'));assert(!f.events.includes('close'));});
test('ambiguous matching targets are blocked without mutation',async()=>{const f=fixture();f.makePage(f.options.pageUrl);await setupTarget(f);await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/ambiguous/);assert(!f.events.includes('create'));assert(!f.events.includes('close'));});
test('creation requires one persistent context',async()=>{const f=fixture(false);f.browser.contexts=()=>[f.context,f.context];await setupTarget(f);await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/Unique assigned persistent context/);assert(!f.events.includes('create'));});
test('redirect and readiness loss preserve partial observable state even with cleanup authorization',async()=>{const f=fixture(false);f.assigned.ownership.cleanup=['target'];f.recorder.identity.assignmentDigest=sha256(JSON.stringify(f.assigned));await setupTarget(f);const original=f.context.newPage;f.context.newPage=async()=>{const p=await original();p.goto=async()=>{};return p;};await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/final URL mismatch/);assert(!f.pages[0].isClosed());assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');});
test('explicit lifecycle cleanup can still dispose the deliberately assigned created target',async()=>{
 const f=fixture(false);f.assigned.ownership.cleanup=['target'];f.recorder.identity.assignmentDigest=sha256(JSON.stringify(f.assigned));
 await setupTarget(f);const target=await readyTarget(f.environment,f.recorder,f.options);
 assert(!target.page.isClosed());await target.dispose();assert(target.page.isClosed());
});
test('cancellation after target creation preserves observable state instead of disposing it',async()=>{
 const f=fixture(false),abort=new AbortController();f.assigned.ownership.cleanup=['target'];f.recorder.identity.assignmentDigest=sha256(JSON.stringify(f.assigned));
 f.options.signal=abort.signal;const original=f.context.newPage;
 f.context.newPage=async()=>{const page=await original();abort.abort();return page;};
 await setupTarget(f);await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/cancelled/);
 assert.equal(f.pages.length,1);assert(!f.pages[0].isClosed());assert(!f.events.includes('close'));
});
test('fresh incarnation is required before target/READY, and proof never reacquires it',async()=>{
 const f=fixture();await setupTarget(f);let revalidations=0;f.session.revalidate=async()=>{if(++revalidations===3)throw Error('Runtime incarnation changed');};
 await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/incarnation changed/);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');assert(!f.events.includes('create'));
});
test('fresh target handle identity is checked at the READY boundary',async()=>{
 const f=fixture();await setupTarget(f);let calls=0;const original=f.context.newCDPSession;
 f.context.newCDPSession=async p=>{const cdp=await original(p);if(++calls===2)cdp.send=async()=>({targetInfo:{targetId:'replacement',type:'page',url:f.options.pageUrl}});return cdp;};
 await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/target incarnation changed/);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');
});
test('missing/corrupted preflight evidence cannot yield READY',async()=>{
 const f=fixture();await browserStage(f);await projectPreflight(f.environment,f.recorder,f.root,hook(f,readyHook));writeFileSync(f.recorder.records[1].evidence[0].path,'changed');
 await assert.rejects(readyTarget(f.environment,f.recorder,f.options),/evidence/);assert.equal(f.recorder.records.at(-1).status,'PREFLIGHT_BLOCKED');
});

for(const cleanup of [[],['target']])test('ordinary proof teardown preserves created pages with cleanup authorization '+JSON.stringify(cleanup),()=>{
 const root=mkdtempSync(join(tmpdir(),'verification-preflight-runner-')),current=structuredClone(identity),assigned=structuredClone(assignment),normative=structuredClone(plan);
 normative.claims[0].allowedEffects=['target-create','target-navigate'];assigned.authorization.allowedEffects=[...normative.claims[0].allowedEffects];assigned.ownership.disposable=['target'];assigned.ownership.cleanup=cleanup;
 const planBytes=JSON.stringify(normative);current.planDigest=sha256(planBytes);assigned.planDigest=current.planDigest;assigned.authorization.planDigest=current.planDigest;current.assignmentDigest=sha256(JSON.stringify(assigned));
 const manifest={schemaVersion:1,identity:current,entries:[{claimId:'browser-version',environmentId:'assigned-chrome',sourceRefs:['requirement'],proofIds:['version-observation'],mode:'automated',testKey:'version-key',source:'tests/fixtures/preflight.spec.ts',title:'ordinary preflight gate',assertions:['version-match'],steps:['observe'],capabilityIds:['chrome:version'],capabilityVersions:{'chrome:version':'1'}}]};
 const resultPath=join(root,'result.json'),outputRoot=join(root,'output'),inputPath=join(root,'input.json');writeFileSync(inputPath,JSON.stringify({planBytes,assignment:assigned,identity:current,manifest,outputRoot,resultPath}));
 const run=childProcess.spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/fixtures/preflight.config.mjs'],{env:{...process.env,VERIFICATION_REFERENCE_INPUT:inputPath},encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stdout+run.stderr+String(run.error)+(run.status!==0?readFileSync(resultPath,'utf8'):''));
 const result=JSON.parse(readFileSync(resultPath));assert.equal(result.runner.status,'passed');assert.equal(result.verdict,'INCONCLUSIVE');assert.equal(result.counts.PASS,0);assert.equal(result.counts.FAIL,0);
 assert.deepEqual(collectPreflight(outputRoot,current).records.map(r=>r.status),['RECOVERED','PASS','CREATED','ENVIRONMENT READY']);
});

test('fixed stage guards stop setup after BLOCKED and browser reacquisition after READY',async()=>{
 const blocked=fixture(false);await blocked.recorder.blocked('browser','Known browser blocker');
 await assert.rejects(projectPreflight(blocked.environment,blocked.recorder,blocked.root),/Browser preflight must succeed/);
 await assert.rejects(targetPreflight(blocked.environment,blocked.recorder,blocked.options),/Browser\/project preflight must succeed/);
 assert(!blocked.events.includes('create'));
 const ready=fixture();await setupTarget(ready);await readyTarget(ready.environment,ready.recorder,ready.options);
 await assert.rejects(browserPreflight(config,ready.recorder),/fresh preflight attempt/);
 assert.equal(ready.recorder.records.at(-1).status,'ENVIRONMENT READY');
});
