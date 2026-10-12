import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,dirname} from 'node:path';
import {assemble,bindingFor} from '../../distribution/package-set.mjs';
import {sha256} from '../../dist/src/resources/resolve.js';
import {invokeReadiness,installedHookSelfCheck,createAdoptionCheckpoint,writeAdoptionCheckpoint,readAdoptionCheckpoint,reserveAdoptionDispatch,adoptionResumeAction,reserveAdoptionCorrection,recordAdoptionCheck,validateAdoptionAssessment,requestAdoptionHITL,resolveAdoptionHITL} from '../../dist/runtime/invoke.js';
import {plan,assignment,provider} from '../fixtures/execution.mjs';

const release={repository:'https://github.com/test-fixture/verification-platform',tag:'v0.0.1',sourceCommit:'f'.repeat(40)};
let platform;
function distribution(){
 if(platform)return platform;
 const parent=mkdtempSync(join(tmpdir(),'adoption-distribution-')),root=join(parent,'platform');
 assemble(release,root,{fixtureOnly:true});
 const bytes=readFileSync(join(root,'resource-index.json'));
 return platform={root,binding:bindingFor(JSON.parse(bytes),bytes),resolution:{root,indexPath:'resource-index.json',mode:'execution'}};
}
const decision=(state='HookNotRequired')=>({state,rationale:'Current Platform requirements and native setup need only assigned browser and target setup',sourceRefs:['contracts/verification-integration.md#readiness'],inputFingerprint:'a'.repeat(64)});
const hitl=()=>({action:'Resolve missing integration',reason:'Caller decision needed',scope:'configured integration',authorizationReference:'request-1',options:[
 {id:'repair',action:'continue',description:'Authorize the installer to restore the diagnosed configuration reference'},
 {id:'cancel',action:'cancel',description:'Cancel Verifier installation'},
]});

test('HITL refinement requires waiting status and the exact cancellation option',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-hitl-invariants-'));
 const initial=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 const waiting=requestAdoptionHITL(initial,hitl());
 for(const status of ['active','blocked','completed','cancelled'])
  assert.throws(()=>writeAdoptionCheckpoint({...waiting,status},null),/Pending HITL requires waiting/);
 assert.throws(()=>writeAdoptionCheckpoint({...initial,status:'waiting'},null),/Waiting requires pending/);
 const options=hitl().options;
 for(const description of ['Cancel the entire Verifier installation','Skip','Cancel Verifier installation.'])
  assert.throws(()=>requestAdoptionHITL(initial,{...hitl(),options:[options[0],{...options[1],description}]}),/labelled Cancel Verifier installation/);
 assert.throws(()=>requestAdoptionHITL(initial,{...hitl(),options:[...options,{...options[1],id:'second-cancel'}]}),/distinct resolution options/);
 assert.throws(()=>requestAdoptionHITL(initial,{...hitl(),options:[options[0],{...options[1],id:options[0].id}]}),/distinct resolution options/);
});

test('HITL refinement writer preserves pending requests until a matching resolution is persisted',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-hitl-persistence-'));
 const waiting=requestAdoptionHITL(createAdoptionCheckpoint(root,binding,'a'.repeat(64)),hitl());
 let digest=writeAdoptionCheckpoint(waiting,null);
 const path=join(root,'.verification/adoption.json'),bytes=readFileSync(path);
 const resolved=resolveAdoptionHITL(waiting,'repair','explicit-decision-1');
 const nextRequest={...hitl(),authorizationReference:'request-2',reason:'A later independent user-owned issue'};
 const invalid=[
  {...waiting,status:'active',pendingHITL:null},
  {...waiting,pendingHITL:nextRequest},
  requestAdoptionHITL(resolved,nextRequest),
  {...resolved,resolution:{...resolved.resolution,requestReference:'unrelated-request'}},
  {...resolved,resolution:{...resolved.resolution,option:{...resolved.resolution.option,description:'Unapproved outcome'}}},
 ];
 for(const checkpoint of invalid){
  assert.throws(()=>writeAdoptionCheckpoint(checkpoint,digest),/matching recorded resolution/);
  assert.deepEqual(readFileSync(path),bytes);
 }
 assert.throws(()=>writeAdoptionCheckpoint({...resolved,resolution:{...resolved.resolution,decisionReference:''}},digest),/Explicit user decision/);
 assert.throws(()=>requestAdoptionHITL(waiting,nextRequest),/pending decision cannot be replaced/);
 const restored=readAdoptionCheckpoint(root,binding,waiting.inputFingerprint).checkpoint;
 assert.equal(adoptionResumeAction(restored),'HITL');assert.deepEqual(restored.pendingHITL,waiting.pendingHITL);
 assert.equal(writeAdoptionCheckpoint(restored,digest),digest);
 digest=writeAdoptionCheckpoint(resolved,digest);
 assert.equal(adoptionResumeAction(readAdoptionCheckpoint(root,binding,waiting.inputFingerprint).checkpoint),'continue');
 const later=requestAdoptionHITL(resolved,nextRequest);digest=writeAdoptionCheckpoint(later,digest);
 assert.throws(()=>writeAdoptionCheckpoint({...later,status:'active',pendingHITL:null},digest),/matching recorded resolution/);
 const laterResolved=resolveAdoptionHITL(later,'repair','explicit-decision-2');
 writeAdoptionCheckpoint(laterResolved,digest);
 assert.equal(laterResolved.resolution.requestReference,'request-2');
 assert.equal(laterResolved.stage,waiting.stage);
});

function consumer({hookStatus,teardownError=false,missing=false,substitute=false,maskRunnerExit=false}={}){
 const platform=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-consumer-'));mkdirSync(join(root,'node_modules'));mkdirSync(join(root,'.verification/integration'),{recursive:true});
 // Test-only pinned dependencies. No global imports or real host/browser calls.
 for(const name of ['@playwright','playwright','playwright-core','@types','typescript','undici-types'])if(existsSync(resolve('node_modules',name)))cpSync(resolve('node_modules',name),join(root,'node_modules',name),{recursive:true});
 writeFileSync(join(root,'package.json'),JSON.stringify({type:'module'}));
 const normative=structuredClone(plan);normative.configurationReferences[0].path='.verification/integration/fixture.ts';normative.configurationReferences[0].disposition='realized';normative.claims[0].allowedEffects=['target-create','target-navigate'];
 const planBytes=JSON.stringify(normative);writeFileSync(join(root,'plan.json'),planBytes);
 const assigned=structuredClone(assignment);assigned.planDigest=sha256(planBytes);assigned.bindingDigest=sha256(JSON.stringify(platform.binding));assigned.authorization={...assigned.authorization,planDigest:assigned.planDigest,bindingDigest:assigned.bindingDigest,allowedEffects:['target-create','target-navigate']};
 assigned.environments[0].launch=true;assigned.fixtureEntry='.verification/integration/fixture.ts';assigned.runnerConfig='.verification/integration/runner.config.mjs';assigned.providers=[{id:'chrome',version:'fixture',entry:'.verification/integration/provider.mjs'}];assigned.outputDirectory='.verification/adoption-evidence';assigned.ownership.disposable=['target'];assigned.ownership.cleanup=[];
 const descriptor=structuredClone(provider);descriptor.declarations='.verification/integration/provider.d.ts';descriptor.capabilities[0].support='established';descriptor.capabilities[0].evidenceRefs=['temporary synthetic fixture only'];
 writeFileSync(join(root,'.verification/integration/provider.mjs'),`export const descriptor=${JSON.stringify(descriptor)};export function browserCDP(){throw Error('Product operation must not be executed by readiness');}`);
 writeFileSync(join(root,'.verification/integration/provider.d.ts'),'export declare function browserCDP(): never;');
 writeFileSync(join(root,'runtime.json'),'{}');writeFileSync(join(root,'assignment.json'),JSON.stringify(assigned));
 const hook=hookStatus?`export const contractVersion=1;export async function runPreflight(c){const {writeFileSync}=await import('node:fs');const {join}=await import('node:path');const {createHash}=await import('node:crypto');const bytes=JSON.stringify({executionId:c.executionIdentity.executionId,consumer:true});const path=join(c.evidenceDirectory,'ready.json');writeFileSync(path,bytes);return {contractVersion:1,status:${JSON.stringify(hookStatus)},reason:'Consumer fixture readiness',evidence:[{path,sha256:createHash('sha256').update(bytes).digest('hex')}],${hookStatus==='NEEDS_HITL'?'hitl:{action:"Perform required setup",reason:"Human authorization required"}':''}};}`:null;
 if(hook)writeFileSync(join(root,'.verification/integration/hook.mjs'),hook);
 const hookReference=hook?{contractVersion:1,entry:'.verification/integration/hook.mjs',sha256:sha256(hook),deadlineMs:1000,input:{expected:'consumer'}}:undefined;
 const fixture=`import {test as platform,expect} from ${JSON.stringify(resolve('dist/runtime/fixtures.js'))};
import {writeFileSync} from 'node:fs';import nativeSetup from './native-setup.cjs';
 const test=platform.extend<{projectSetupReady:boolean}, {browserEnvironment:any}>({projectSetupReady:async({assignedPage},use)=>{void assignedPage;nativeSetup.setup();await use(true);nativeSetup.teardown();},browserEnvironment:[async({preflightRecorder,pageUrl},use)=>{
 const pages:any[]=[];const browser:any={isConnected:()=>true,contexts:()=>[context]};
 const context:any={browser:()=>browser,pages:()=>pages,newPage:async()=>{let url='about:blank';const page:any={isClosed:()=>false,url:()=>url,context:()=>context,goto:async(value:string)=>{url=value;},waitForLoadState:async()=>{},close:async()=>{throw Error('Browser state must be preserved');}};pages.push(page);return page;},newCDPSession:async(page:any)=>({send:async()=>({targetInfo:{targetId:'synthetic-current',type:'page',url:page.url()}}),detach:async()=>{}})};
 const provenance={binary:'synthetic',profile:'synthetic',version:'synthetic',process_id:1,started_at:'synthetic',webSocketDebuggerUrl:'ws://synthetic.invalid'};
 await preflightRecorder.append({stage:'browser',status:'RECOVERED',reason:'Synthetic host used only by deterministic tests',observations:provenance,evidence:[],cleanupErrors:[]});
 await use({browser,provenance,session:{endpoint:'synthetic',provenance,revalidate:async()=>{},dispose:async()=>{}}});
 writeFileSync('preserved.json',JSON.stringify({pages:pages.length}));${teardownError?'throw Error("Synthetic temporary-resource teardown failed");':''}
},{scope:'worker'}]});export {test,expect};`;
 writeFileSync(join(root,'native-fixture.ts'),fixture);
 writeFileSync(join(root,'native-setup.cjs'),`const fs=require('node:fs');exports.setup=()=>fs.writeFileSync('custom-ready.json','ready');exports.teardown=()=>fs.writeFileSync('native-teardown.json','done');`);
 writeFileSync(join(root,'.verification/integration/fixture.ts'),`export {test,expect} from '../../native-fixture';`);
 writeFileSync(join(root,'product.spec.ts'),`throw Error('Product body must never be collected');`);
 writeFileSync(join(root,'.verification/integration/runner.config.mjs'),`import {readFileSync} from 'node:fs';export default {testDir:'.',testMatch:'product.spec.ts',workers:3,retries:2,use:{hostConfig:{runtimeConfig:'runtime.json',powershell:'explicit-fixture-command',launch:true,readinessMs:2000,disposalMs:100},pageUrl:'https://fixture.invalid',preflight:{projectRoot:${JSON.stringify(root)},environmentId:'assigned-chrome',assignment:JSON.parse(readFileSync(new URL('../../assignment.json',import.meta.url))),planBytes:readFileSync(new URL('../../plan.json',import.meta.url),'utf8'),${hookReference?'projectPreflightHook:'+JSON.stringify(hookReference):''}}}};`);
 if(missing)writeFileSync(join(root,'.verification/integration/fixture.ts'),'export const unavailable=1;');
 if(substitute)writeFileSync(join(root,'.verification/integration/fixture.ts'),`export {test,expect} from '@playwright/test';`);
 const input={cwd:root,planPath:'plan.json',binding:platform.binding,resolution:platform.resolution,assignment:assigned,environmentId:'assigned-chrome',claimIds:['browser-version'],hookDecision:decision(hook?'HookRequired':'HookNotRequired'),inputFingerprint:'a'.repeat(64),runnerEntry:'.verification/integration/readiness.mjs',probePath:'.verification/integration/setup.spec.ts',deadlineMs:30000};
 // Installer-produced invocation/composition: Platform receives JSON only.
 writeFileSync(join(root,'.verification/integration/setup.spec.ts'),`import {readFileSync} from 'node:fs';import {test,expect} from './fixture';const r=JSON.parse(readFileSync(process.env.READINESS_CONTEXT,'utf8'));test('setup only',{annotation:{type:'testKey',description:r.testKey}},async({environmentReady,preflightRecorder,projectSetupReady})=>{void environmentReady;void projectSetupReady;expect(preflightRecorder.records.at(-1)?.status).toBe('ENVIRONMENT READY');});`);
 writeFileSync(join(root,'.verification/integration/readiness.config.mjs'),`import native from './runner.config.mjs';import {readFileSync} from 'node:fs';import {recordReadinessConfiguration} from ${JSON.stringify(resolve('dist/runtime/invoke.js'))};const r=JSON.parse(readFileSync(process.env.READINESS_CONTEXT,'utf8'));const readiness=recordReadinessConfiguration(r,native.use,'setup');export default {...native,workers:1,fullyParallel:false,retries:0,repeatEach:1,testDir:${JSON.stringify(join(root,'.verification/integration'))},testMatch:'setup.spec.ts',outputDir:r.outputRoot+'/records',reporter:[[${JSON.stringify(resolve('dist/runtime/adoption-readiness.js'))},r]],projects:[{name:'setup',use:{...native.use,executionIdentity:r.identity,preflight:{...native.use.preflight,readiness}}}]};`);
 writeFileSync(join(root,'.verification/integration/readiness.mjs'),`import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';const requestPath=process.argv[2];const r=JSON.parse(readFileSync(requestPath,'utf8'));const run=spawnSync(process.execPath,[${JSON.stringify(resolve('node_modules/@playwright/test/cli.js'))},'test','--config',${JSON.stringify(join(root,'.verification/integration/readiness.config.mjs'))}],{stdio:'inherit',env:{...process.env,READINESS_CONTEXT:requestPath}});if(run.error)throw run.error;if(run.signal)throw Error('Native runner interrupted');const summary=JSON.parse(readFileSync(r.summaryPath,'utf8'));summary.runner.exitCode=run.status;writeFileSync(r.summaryPath,JSON.stringify(summary));process.exitCode=${maskRunnerExit?'0':'run.status'};`);
 input.sources=['native-fixture.ts','native-setup.cjs','runtime.json','.verification/integration/readiness.config.mjs'].map(path=>({path,sha256:sha256(readFileSync(join(root,path)))}));
 return {root,input,fixture};
}

test('installed self-check executes indexed canary in isolation and refuses relaunch or mutation',async()=>{
 const {binding,resolution,root}=distribution(),parent=mkdtempSync(join(tmpdir(),'adoption-canary-')),out=join(parent,'attempt');
 const report=await installedHookSelfCheck(binding,resolution,out,'hook-self-check',1);
 assert.equal(report.outcome,'PASS');assert.equal(report.synthetic,true);assert.equal(report.evidence.length,2);
 assert(!existsSync(join(out,'product-result.json')));
 await assert.rejects(installedHookSelfCheck(binding,resolution,out),/already exists/);
 const canary=join(root,'dist/runtime/assets/adoption-hook-canary.mjs'),bytes=readFileSync(canary);writeFileSync(canary,'mutated');
 await assert.rejects(installedHookSelfCheck(binding,resolution,join(parent,'mutated')),/digest mismatch/);writeFileSync(canary,bytes);
});

for(const hookStatus of [undefined,'READY'])test('actual consumer runner/fixture reaches readiness with '+(hookStatus?'required hook':'deliberate no-hook'),async()=>{
 const {root,input,fixture}=consumer({hookStatus});
 if(hookStatus){
  const configPath=join(root,input.assignment.runnerConfig);
  const native=readFileSync(configPath,'utf8').replace("import {readFileSync} from 'node:fs';export default ","const {readFileSync}=require('node:fs');module.exports=(hook)=> (").replace(/new URL\('\.\.\/\.\.\/(assignment|plan)\.json',import\.meta\.url\)/g,"require('node:path').join(__dirname,'$1.json')");
  writeFileSync(join(root,'native-runner.cjs'),native.replace(/;$/,');'));
  writeFileSync(configPath,"import create from '../../native-runner.cjs';export default create();");
  input.sources.push({path:'native-runner.cjs',sha256:sha256(readFileSync(join(root,'native-runner.cjs')))});
  const entry=join(root,input.runnerEntry);
  writeFileSync(join(root,'.verification/integration/readiness.cjs'),readFileSync(entry,'utf8').replace("import {spawnSync} from 'node:child_process';","const {spawnSync}=require('node:child_process');").replace("import {readFileSync,writeFileSync} from 'node:fs';","const {readFileSync,writeFileSync}=require('node:fs');"));
  input.runnerEntry='.verification/integration/readiness.cjs';
 }
 const result=await invokeReadiness({...input,executionId:'readiness-current',requiredFixtures:['projectSetupReady']});
 assert.equal(result.outcome,'PASS',JSON.stringify(result,null,2));assert.equal(result.runner.exitCode,0);assert.equal(result.evidence.length,4);
 assert.equal(JSON.parse(readFileSync(join(root,'preserved.json'))).pages,1);
 assert.equal(readFileSync(join(root,'custom-ready.json'),'utf8'),'ready');
 assert.equal(readFileSync(join(root,'native-teardown.json'),'utf8'),'done');
 const attempt=JSON.parse(readFileSync(resolve(dirname(result.evidence[0]),'..','request.json')));
 assert(!readdirSync(attempt.outputRoot).some(p=>/\.(ts|js|mjs|cjs)$/.test(p)));
 assert(result.sources.some(s=>s.path===join(root,input.runnerEntry)));
 assert(result.sources.some(s=>s.path===join(root,'.verification/integration/readiness.config.mjs')));
 assert.equal(readFileSync(join(root,'native-fixture.ts'),'utf8'),fixture);
 assert.equal(readFileSync(join(root,'product.spec.ts'),'utf8'),`throw Error('Product body must never be collected');`);
 assert(result.configurationFingerprint);assert(!readdirSync(join(root,'.verification/adoption-evidence')).some(p=>p.startsWith('claim-')));
 await assert.rejects(invokeReadiness({...input,executionId:'readiness-current'}),/already exists/);
 if(!hookStatus){
  // Reuse this real synthetic consumer probe to prove adoption completion and
  // invalidation, rather than dispatching a duplicate readiness attempt.
  const reportPath=resolve(dirname(result.evidence[0]),'..','readiness.json');
  const ref=path=>({path:relative(root,path),sha256:sha256(readFileSync(path))});
  const selfRoot=join(root,'self-check');await installedHookSelfCheck(input.binding,input.resolution,selfRoot,'self-current',1);
  writeFileSync(join(root,'integration.json'),JSON.stringify({fixture:'fixture.ts',obligation:'contracts/verification-integration.md#readiness',callable:true}));
  let checkpoint=createAdoptionCheckpoint(root,input.binding,input.inputFingerprint);checkpoint.hookDecision=input.hookDecision;
  checkpoint=reserveAdoptionDispatch(checkpoint,{executionId:'readiness-current',attempt:1,kind:'readiness',inputFingerprint:input.inputFingerprint,commandFingerprint:'b'.repeat(64)});
  assert.throws(()=>recordAdoptionCheck({...checkpoint,activeDispatch:{...checkpoint.activeDispatch,executionId:'wrong-attempt'}},ref(reportPath)),/identity/);
  checkpoint=recordAdoptionCheck(checkpoint,ref(reportPath));
  const assessment={inputFingerprint:input.inputFingerprint,bindingDigest:sha256(JSON.stringify(input.binding)),resolution:input.resolution,frontendConfiguration:ref(join(root,'integration.json')),integration:ref(join(root,'integration.json')),selfCheck:ref(join(selfRoot,'self-check.json')),readiness:[ref(reportPath)],prerequisites:[{sourceRef:'contracts/verification-integration.md#readiness',reason:'Assigned browser, target and fixture callable',evidence:[ref(reportPath)]}],unresolved:[]};
  validateAdoptionAssessment(checkpoint,assessment);
  writeFileSync(join(root,'assessment.json'),JSON.stringify(assessment));checkpoint.assessment=ref(join(root,'assessment.json'));checkpoint.stage='PASS';checkpoint.status='completed';
  writeAdoptionCheckpoint(checkpoint,null);assert.equal(adoptionResumeAction(readAdoptionCheckpoint(root,input.binding,input.inputFingerprint).checkpoint),'complete');
  const recordPath=result.evidence[2],recordBytes=readFileSync(recordPath);writeFileSync(recordPath,'mutated');
  assert.throws(()=>readAdoptionCheckpoint(root,input.binding,input.inputFingerprint),/evidence no longer valid/);writeFileSync(recordPath,recordBytes);
  writeFileSync(join(root,'.verification/integration/fixture.ts'),fixture+'\n// changed after probe');assert.throws(()=>validateAdoptionAssessment(checkpoint,assessment),/integration changed/);
 }
});

test('consumer NEEDS_HITL blocks target and product work',async()=>{
 const {root,input}=consumer({hookStatus:'NEEDS_HITL'}),result=await invokeReadiness(input);
 assert.equal(result.outcome,'BLOCKED',JSON.stringify(result));
 assert.equal(JSON.parse(readFileSync(join(root,'preserved.json'))).pages,0);
});
test('normal completion including fixture teardown is required after READY',async()=>{
 const {input}=consumer({teardownError:true}),result=await invokeReadiness(input);
 assert.notEqual(result.outcome,'PASS');assert.notEqual(result.runner.exitCode,0);
});
test('an unrelated standard fixture cannot substitute for the actual readiness gate',async()=>{
 const {input}=consumer({substitute:true});
 assert.notEqual((await invokeReadiness(input)).outcome,'PASS');
});
test('unresolved hook decisions and invalid claim selection do not become no-hook PASS',async()=>{
 const {input}=consumer();await assert.rejects(invokeReadiness({...input,hookDecision:decision('Unresolved')}),/unresolved/);
 const {validateReadinessSelection}=await import('../../dist/runtime/adoption-readiness.js');
 assert.throws(()=>validateReadinessSelection({projectRoot:input.cwd,environmentId:input.environmentId,assignment:input.assignment,planBytes:JSON.stringify(plan),readiness:{testKey:'probe',claimIds:['unknown'],hookDecision:decision(),configurationFingerprint:'f'.repeat(64)}}),/existing applicable claims/);
});
test('missing applicable provider wiring and mismatched runner host block before consumer setup',async()=>{
 const {root,input}=consumer();
 const original=readFileSync(join(root,'.verification/integration/provider.mjs'),'utf8');writeFileSync(join(root,'.verification/integration/provider.mjs'),original.replace('"support":"established"','"support":"unestablished"'));
 await assert.rejects(invokeReadiness(input),/missing or unestablished/);assert(!existsSync(join(root,'preserved.json')));
 writeFileSync(join(root,'.verification/integration/provider.mjs'),original);
 const configPath=join(root,'.verification/integration/runner.config.mjs');writeFileSync(configPath,readFileSync(configPath,'utf8').replace("powershell:'explicit-fixture-command'","powershell:'wrong-host-command'"));
 const result=await invokeReadiness(input);assert.equal(result.outcome,'BLOCKED');assert(!existsSync(join(root,'preserved.json')));
});

test('checkpoint CAS, changed input/release and active dispatch resume prevent duplicate launch',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-checkpoint-'));
 let checkpoint=createAdoptionCheckpoint(root,binding,'a'.repeat(64));let digest=writeAdoptionCheckpoint(checkpoint,null);
 assert.deepEqual(readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint,checkpoint);
 assert.throws(()=>writeAdoptionCheckpoint(checkpoint,null),/changed/);
 assert.throws(()=>readAdoptionCheckpoint(root,binding,'b'.repeat(64)),/changed/);
 assert.throws(()=>readAdoptionCheckpoint(root,{...binding,tag:'v0.0.2'},'a'.repeat(64)),/changed/);
 const checkpointPath=join(root,'.verification/adoption.json'),savedBytes=readFileSync(checkpointPath);writeFileSync(checkpointPath,JSON.stringify({...checkpoint,formatVersion:2}));
 assert.throws(()=>readAdoptionCheckpoint(root,binding,'a'.repeat(64)),/format/);writeFileSync(checkpointPath,savedBytes);
 checkpoint=reserveAdoptionDispatch(checkpoint,{executionId:'attempt',attempt:1,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)});
 digest=writeAdoptionCheckpoint(checkpoint,digest);assert.equal(adoptionResumeAction(readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint),'BLOCKED');
 assert.throws(()=>reserveAdoptionDispatch(checkpoint,{executionId:'duplicate',attempt:1,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)}),/reconciled/);
 checkpoint.activeDispatch.status='running';checkpoint.activeDispatch.handle='explicit-tool-handle';digest=writeAdoptionCheckpoint(checkpoint,digest);assert.equal(adoptionResumeAction(checkpoint),'follow');
 checkpoint=requestAdoptionHITL(checkpoint,hitl());writeAdoptionCheckpoint(checkpoint,digest);assert.equal(adoptionResumeAction(checkpoint),'HITL');
 assert.throws(()=>resolveAdoptionHITL(checkpoint,'repair','user-decision'),/Reconcile active dispatch/);
 const cancelled=resolveAdoptionHITL(checkpoint,'cancel','user-decision');
 assert.equal(adoptionResumeAction(cancelled),'cancelled');assert.deepEqual(cancelled.activeDispatch,checkpoint.activeDispatch);
 assert.throws(()=>reserveAdoptionDispatch(cancelled,{executionId:'cancelled-relaunch',attempt:2,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)}),/reconciled/);
});
test('correction intent persists and unreconciled effects cannot be replayed',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-correction-')),file=join(root,'diagnosis.json');writeFileSync(file,'{}');
 const evidence={path:'diagnosis.json',sha256:sha256('{}')},checkpoint=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 const reserved=reserveAdoptionCorrection(checkpoint,'confirmed-path-defect',evidence);writeAdoptionCheckpoint(reserved,null);
 assert.equal(readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint.defect.correction,'reserved');
 assert.throws(()=>reserveAdoptionCorrection(reserved,'confirmed-path-defect',evidence),/Reconcile/);
 writeFileSync(file,'changed');assert.throws(()=>reserveAdoptionCorrection(checkpoint,'different-defect',evidence),/evidence changed/);
});
test('installation-only and readiness-only state cannot complete adoption',()=>{
 const {binding,resolution}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-assessment-'));const checkpoint=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 assert.throws(()=>writeAdoptionCheckpoint({...checkpoint,status:'completed',stage:'PASS'},null),/assessment/);
 checkpoint.hookDecision=decision();
 assert.throws(()=>validateAdoptionAssessment(checkpoint,{inputFingerprint:checkpoint.inputFingerprint,bindingDigest:sha256(JSON.stringify(binding)),resolution,readiness:[],prerequisites:[],unresolved:[]}),/incomplete/);
});

test('failed installation check stays resumable and HITL waits for an explicit viable option',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-decision-'));
 let checkpoint=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 checkpoint=reserveAdoptionDispatch(checkpoint,{executionId:'blocked-check',attempt:1,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)});
 const report={purpose:'consumer-readiness',identity:{executionId:'blocked-check',attempt:1,bindingDigest:sha256(JSON.stringify(binding))},inputFingerprint:checkpoint.inputFingerprint,outcome:'BLOCKED'};
 writeFileSync(join(root,'blocked.json'),JSON.stringify(report));
 checkpoint=recordAdoptionCheck(checkpoint,{path:'blocked.json',sha256:sha256(JSON.stringify(report))});
 assert.equal(adoptionResumeAction(checkpoint),'continue');assert.equal(checkpoint.lastCheck.outcome,'BLOCKED');
 checkpoint.status='blocked';assert.equal(adoptionResumeAction(checkpoint),'BLOCKED');
 assert.throws(()=>requestAdoptionHITL(checkpoint,{...hitl(),options:[hitl().options[0]]}),/cancellation/);
 assert.throws(()=>requestAdoptionHITL(checkpoint,{...hitl(),options:[hitl().options[1]]}),/resolution options/);
 checkpoint=requestAdoptionHITL(checkpoint,hitl());const digest=writeAdoptionCheckpoint(checkpoint,null);
 checkpoint=readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint;
 assert.equal(adoptionResumeAction(checkpoint),'HITL');
 assert.throws(()=>resolveAdoptionHITL(checkpoint,'repair',''),/explicit user decision/);
 assert.throws(()=>resolveAdoptionHITL(checkpoint,'unoffered','decision-1'),/presented resolution/);
 assert.throws(()=>reserveAdoptionDispatch(checkpoint,{executionId:'hidden-retry',attempt:2,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)}),/reconciled/);
 checkpoint=resolveAdoptionHITL(checkpoint,'repair','decision-1');writeAdoptionCheckpoint(checkpoint,digest);
 assert.equal(adoptionResumeAction(checkpoint),'continue');assert.equal(checkpoint.pendingHITL,null);
 assert.equal(checkpoint.resolution.option.id,'repair');assert.equal(checkpoint.resolution.decisionReference,'decision-1');
 assert.equal(checkpoint.lastCheck.outcome,'BLOCKED');assert.equal(checkpoint.stage,'INSTALL / UPGRADE');
 const fresh=reserveAdoptionDispatch(checkpoint,{executionId:'approved-recheck',attempt:2,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)});
 assert.equal(fresh.activeDispatch.executionId,'approved-recheck');
});

test('explicit cancellation is durable and prevents further installation dispatch or repair',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-cancel-'));
 const initial=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 assert.throws(()=>writeAdoptionCheckpoint({...initial,status:'cancelled'},null),/explicit user choice/);
 const waiting=requestAdoptionHITL(initial,hitl());const digest=writeAdoptionCheckpoint(waiting,null);
 const cancelled=resolveAdoptionHITL(waiting,'cancel','user-cancel-decision');writeAdoptionCheckpoint(cancelled,digest);
 const saved=readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint;
 assert.equal(adoptionResumeAction(saved),'cancelled');assert.equal(saved.resolution.decisionReference,'user-cancel-decision');
 assert.throws(()=>requestAdoptionHITL(saved,hitl()),/Terminal/);
 assert.throws(()=>reserveAdoptionDispatch(saved,{executionId:'after-cancel',attempt:1,kind:'readiness',inputFingerprint:saved.inputFingerprint,commandFingerprint:'b'.repeat(64)}),/reconciled/);
 assert.throws(()=>reserveAdoptionCorrection(saved,'defect',{path:'unused',sha256:'a'.repeat(64)}),/Resolve/);
 assert.throws(()=>writeAdoptionCheckpoint({...saved,status:'active'},sha256(readFileSync(join(root,'.verification/adoption.json')))),/cannot resume/);
});

test('checkpoint writer cannot reopen persisted user cancellation by clearing its resolution',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-terminal-boundary-'));
 let checkpoint=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 checkpoint=reserveAdoptionDispatch(checkpoint,{executionId:'preserved-dispatch',attempt:1,kind:'readiness',inputFingerprint:checkpoint.inputFingerprint,commandFingerprint:'b'.repeat(64)});
 checkpoint.activeDispatch.status='running';checkpoint.activeDispatch.handle='existing-active-handle';
 const waiting=requestAdoptionHITL(checkpoint,hitl()),previousDigest=writeAdoptionCheckpoint(waiting,null);
 const cancelled=resolveAdoptionHITL(waiting,'cancel','explicit-user-decline'),digest=writeAdoptionCheckpoint(cancelled,previousDigest);
 const path=join(root,'.verification/adoption.json'),terminalBytes=readFileSync(path);
 for(const status of ['active','waiting','blocked']){
  const reopened={...cancelled,status,resolution:null,activeDispatch:null,pendingHITL:status==='waiting'?hitl():null};
  assert.throws(()=>writeAdoptionCheckpoint(reopened,digest),/Persisted cancelled workflow is terminal/);
  assert.deepEqual(readFileSync(path),terminalBytes);
 }
 assert.throws(()=>writeAdoptionCheckpoint(createAdoptionCheckpoint(root,binding,'b'.repeat(64)),digest),/terminal/);
 assert.throws(()=>writeAdoptionCheckpoint(cancelled,previousDigest),/Checkpoint changed/);
 const saved=readAdoptionCheckpoint(root,binding,'a'.repeat(64)).checkpoint;
 assert.equal(adoptionResumeAction(saved),'cancelled');assert.deepEqual(saved.activeDispatch,checkpoint.activeDispatch);
 assert.equal(writeAdoptionCheckpoint(saved,digest),digest);
 assert.throws(()=>reserveAdoptionDispatch(saved,{executionId:'new-work',attempt:2,kind:'readiness',inputFingerprint:saved.inputFingerprint,commandFingerprint:'b'.repeat(64)}),/reconciled/);
});

test('revised corrections continue after reconciliation without a user quota',()=>{
 const {binding}=distribution(),root=mkdtempSync(join(tmpdir(),'adoption-approved-repair-'));
 writeFileSync(join(root,'diagnosis.json'),'{}');const evidence={path:'diagnosis.json',sha256:sha256('{}')};
 const initial=createAdoptionCheckpoint(root,binding,'a'.repeat(64));
 const reserved=reserveAdoptionCorrection(initial,'same-cause',evidence);
 const interrupted=requestAdoptionHITL(reserved,hitl());
 assert.throws(()=>resolveAdoptionHITL(interrupted,'repair','decision-2'),/reserved correction postconditions/);
 assert.throws(()=>reserveAdoptionCorrection(reserved,'different-cause',evidence),/Reconcile/);
 const applied={...reserved,inputFingerprint:'b'.repeat(64),defect:{...reserved.defect,correction:'applied',afterFingerprint:'b'.repeat(64)}};
 assert.throws(()=>reserveAdoptionCorrection(applied,'same-cause',evidence),/unchanged retries/);
 writeFileSync(join(root,'revised-diagnosis.json'),'revised bridge');
 const revised={path:'revised-diagnosis.json',sha256:sha256('revised bridge')};
 const corrected=reserveAdoptionCorrection(applied,'same-cause',revised);
 assert.equal(corrected.resolution,initial.resolution);assert.equal(corrected.defect.correction,'reserved');
 assert.equal(corrected.defect.beforeFingerprint,applied.inputFingerprint);
 const reconciled={...corrected,inputFingerprint:'c'.repeat(64),defect:{...corrected.defect,correction:'applied',afterFingerprint:'c'.repeat(64)}};
 const fresh=reserveAdoptionDispatch(reconciled,{executionId:'revised-affected-check',attempt:2,kind:'readiness',inputFingerprint:reconciled.inputFingerprint,commandFingerprint:'d'.repeat(64)});
 const report={purpose:'consumer-readiness',identity:{executionId:'revised-affected-check',attempt:2,bindingDigest:sha256(JSON.stringify(binding))},inputFingerprint:reconciled.inputFingerprint,outcome:'FAIL'};
 const bytes=JSON.stringify(report);writeFileSync(join(root,'revised-check.json'),bytes);
 const checked=recordAdoptionCheck(fresh,{path:'revised-check.json',sha256:sha256(bytes)});
 assert.equal(checked.status,'active');assert.equal(checked.lastCheck.executionId,'revised-affected-check');
 assert.equal(checked.defect.beforeFingerprint,'b'.repeat(64));assert.equal(checked.defect.afterFingerprint,'c'.repeat(64));
 assert.throws(()=>reserveAdoptionCorrection(corrected,'same-cause',revised),/Reconcile/);
 assert.throws(()=>reserveAdoptionCorrection({...applied,inputFingerprint:'c'.repeat(64)},'same-cause',revised),/Reconcile/);
});

test('entry success cannot hide a failed actual runner after READY',async()=>{
 const {input}=consumer({teardownError:true,maskRunnerExit:true});
 const report=await invokeReadiness(input);
 assert.equal(report.entry.exitCode,0);assert.notEqual(report.runner.exitCode,0);
 assert.notEqual(report.outcome,'PASS');
});

test('generated entry/probe confinement and declared native freshness fail before dispatch',async()=>{
 const {root,input}=consumer();
 symlinkSync(join(root,'native-fixture.ts'),join(root,'.verification/integration/escaped.ts'));
 await assert.rejects(invokeReadiness({...input,probePath:'.verification/integration/escaped.ts'}),/outside assigned directory/);
 await assert.rejects(invokeReadiness({...input,runnerEntry:'native-fixture.ts'}),/outside assigned directory/);
 writeFileSync(join(root,'native-fixture.ts'),'changed native input');
 await assert.rejects(invokeReadiness(input),/source identity changed/);
 assert(!existsSync(join(root,'custom-ready.json')));
});

// A bounded installer realization fixture: derivation is frontend work, not a
// Platform regeneration API. Native inputs, never old output, select its hook.
test('install, upgrade and recovery freshly derive owned bridges and hook decisions while retaining protected bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'adoption-regeneration-'));
 const integration=join(root,'.verification/integration');mkdirSync(integration,{recursive:true});
 const native=join(root,'native.json');writeFileSync(native,JSON.stringify({module:'native.cjs',requiresHook:true}));
 writeFileSync(join(root,'native.cjs'),'exports.ready=()=>true;');
 for(const path of ['.verification/platform/release.json','.verification/adoption.json','.verification/approvals.json','.verification/adoption-evidence/previous.json']){
  mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),'retained '+path);
 }
 const protectedPaths=['native.json','native.cjs','.verification/platform/release.json','.verification/adoption.json','.verification/approvals.json','.verification/adoption-evidence/previous.json'];
 const before=protectedPaths.map(path=>readFileSync(join(root,path),'utf8'));
 const derive=()=>{
  const current=JSON.parse(readFileSync(native,'utf8'));
  const bridge=`import native from '../../${current.module}';export const ready=native.ready;`;
  writeFileSync(join(integration,'bridge.mjs'),bridge);
  const hookDecision=decision(current.requiresHook?'HookRequired':'HookNotRequired');
  // An old generated hook cannot create a new requirement. The no-hook
  // realization omits its reference; old output need not be deleted.
  if(current.requiresHook)writeFileSync(join(integration,'hook.mjs'),`export const contractVersion=1;export const observedCondition='native.ready';`);
  writeFileSync(join(integration,'wiring.json'),JSON.stringify({hook:current.requiresHook?'.verification/integration/hook.mjs':null,hookDecision}));
  return {bridge,hookDecision};
 };
 for(const stage of ['install','upgrade','recovery']){
  writeFileSync(join(integration,'bridge.mjs'),`old valid-looking ${stage} output requiring an unrelated condition`);
  const derived=derive();assert.equal(derived.hookDecision.state,'HookRequired');
  assert.equal(readFileSync(join(integration,'bridge.mjs'),'utf8'),derived.bridge);
  assert(!derived.bridge.includes('unrelated'));
  assert.deepEqual(protectedPaths.map(path=>readFileSync(join(root,path),'utf8')),before);
 }
 const unchanged=derive();assert.equal(unchanged.bridge,derive().bridge);
 writeFileSync(native,JSON.stringify({module:'native.cjs',requiresHook:false}));
 const fresh=derive();assert.equal(fresh.hookDecision.state,'HookNotRequired');
 assert.equal(JSON.parse(readFileSync(join(integration,'wiring.json'))).hook,null);
 assert.deepEqual(protectedPaths.slice(1).map(path=>readFileSync(join(root,path),'utf8')),before.slice(1));
});
