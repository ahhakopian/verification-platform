import {chromium,type Browser,type Page} from '@playwright/test';
import {readFileSync,realpathSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {isAbsolute,resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {acquireSession,type HostConfig} from './host/wsl-windows/session.js';
import {PreflightRecorder,confinedPath,validatePreflightRecord,validatePreflightOrder,collectPreflight} from './evidence/readiness.js';
import {sha256} from '../src/resources/resolve.js';
import {validateSchema} from '../src/validation/schema.js';
import type {OwnedSession,BrowserProvenance,ProjectPreflightHookReference,ProjectPreflightContext,ProjectPreflightResult,Assignment,Plan,Manifest} from '../src/contracts/index.js';
export type {ProjectPreflightHookReference,ProjectPreflightContext,ProjectPreflightResult,PreflightRecord} from '../src/contracts/index.js';
export {PreflightRecorder} from './evidence/readiness.js';

export interface PreflightOptions {projectRoot:string;environmentId:string;assignment:Assignment;planBytes:string;manifest:Manifest;projectPreflightHook?:ProjectPreflightHookReference}
export interface BrowserEnvironment {browser:Browser;session:OwnedSession;provenance:BrowserProvenance}

// Bounded setup only. This never retries or replaces an attachment after READY.
async function bounded<T>(operation:(signal:AbortSignal)=>Promise<T>,deadlineMs:number,signal?:AbortSignal):Promise<T>{
 if(!Number.isFinite(deadlineMs)||deadlineMs<=0)throw Error('Positive preflight deadline required');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let cancel:()=>void=()=>{};
 const stopped=new Promise<never>((_,reject)=>{
  cancel=()=>{controller.abort();reject(Error('Preflight cancelled'));};
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(Error('Preflight deadline exceeded'));},deadlineMs);
 });
 try{if(controller.signal.aborted)return await stopped;return await Promise.race([operation(controller.signal),stopped]);}
 finally{if(timer)clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();}
}
const detail=(error:unknown)=>error instanceof Error?error.message:String(error);
function connected(environment:BrowserEnvironment){if(!environment.browser.isConnected())throw Error('Assigned browser disconnected; fresh preflight required');}
function provenance(session:OwnedSession):BrowserProvenance {
 const p=session.provenance as BrowserProvenance;
 if(!p||!p.binary||!p.profile||!p.version||!p.process_id||!p.started_at||!p.webSocketDebuggerUrl)throw Error('Current browser provenance required');return structuredClone(p);
}
export async function browserPreflight(config:HostConfig,recorder:PreflightRecorder):Promise<BrowserEnvironment>{
 let session:OwnedSession|undefined;const started=Date.now();
 if(recorder.records.length)throw Error('Browser acquisition requires a fresh preflight attempt');
 try{
  if(!config)throw Error('Explicit runtime configuration required');
  session=await acquireSession(config);
  const current=session;
  const environment=await bounded(async()=>{await current.revalidate();const browser=await chromium.connectOverCDP(current.endpoint,{timeout:Math.max(1,config.readinessMs-(Date.now()-started))});const environment={browser,session:current,provenance:provenance(current)};connected(environment);await current.revalidate();return environment;},config.readinessMs-(Date.now()-started),config.signal);
  await recorder.append({stage:'browser',status:environment.provenance.launched===true?'RECOVERED':'PASS',reason:environment.provenance.launched===true?'Exact configured Chrome launched and attached':'Exact configured Chrome validated and attached',observations:{...JSON.parse(JSON.stringify(environment.provenance)),launched:environment.provenance.launched===true,started,ended:Date.now()},evidence:[],cleanupErrors:[]});
  return environment;
 }catch(error){
  const cleanupErrors=[...((error as {cleanupErrors?:string[]})?.cleanupErrors??[])];if(session)try{await session.dispose();}catch(cleanup){cleanupErrors.push(detail(cleanup));}
  const failure=Object.assign(new Error(detail(error)+(config&&!config.launch?' (launch is not authorized)':''),{cause:error}),{raw:(error as {raw?:unknown})?.raw,cleanupErrors});
  await recorder.blocked('browser',failure);throw failure;
 }
}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function json(value:unknown):boolean {
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(Array.isArray(value))return value.every(json);
 return object(value)&&Object.getPrototypeOf(value)===Object.prototype&&Object.values(value).every(json);
}
function exactKeys(value:Record<string,unknown>,keys:string[]){return Object.keys(value).every(k=>keys.includes(k));}
function validateReference(reference:ProjectPreflightHookReference){
 if(!object(reference)||!exactKeys(reference,['contractVersion','entry','sha256','deadlineMs','input'])||reference.contractVersion!==1||typeof reference.entry!=='string'||!reference.entry||isAbsolute(reference.entry)||/^[A-Za-z]:|\\/.test(reference.entry)||!/\.(mjs|cjs|js)$/.test(reference.entry)||!(/^[a-f0-9]{64}$/.test(reference.sha256))||!Number.isFinite(reference.deadlineMs)||reference.deadlineMs<=0||!json(reference.input))throw Error('Invalid project preflight hook reference/version/input');
}
function validateHookResult(value:unknown):asserts value is ProjectPreflightResult {
 if(!object(value)||!exactKeys(value,['contractVersion','status','reason','evidence','hitl'])||value.contractVersion!==1||typeof value.status!=='string'||!['READY','NEEDS_HITL','BLOCKED'].includes(value.status)||typeof value.reason!=='string'||!value.reason.trim()||!Array.isArray(value.evidence)||value.evidence.some(e=>!object(e)||!exactKeys(e,['path','sha256'])||typeof e.path!=='string'||!e.path||typeof e.sha256!=='string'||!/^[a-f0-9]{64}$/.test(e.sha256)))throw Error('Invalid project preflight hook result');
 if(value.status==='READY'&&value.evidence.length===0)throw Error('READY hook requires readiness evidence');
 if(value.status==='NEEDS_HITL'){if(!object(value.hitl)||!exactKeys(value.hitl,['action','reason'])||typeof value.hitl.action!=='string'||!value.hitl.action.trim()||typeof value.hitl.reason!=='string'||!value.hitl.reason.trim())throw Error('NEEDS_HITL requires action/reason');}
 else if('hitl' in value)throw Error('HITL request is only valid for NEEDS_HITL');
}
export async function projectPreflight(environment:BrowserEnvironment,recorder:PreflightRecorder,projectRoot:string,reference?:ProjectPreflightHookReference,signal?:AbortSignal):Promise<void>{
 const started=Date.now();
 try{
  if(recorder.records.length!==1||!['PASS','RECOVERED'].includes(recorder.records[0]?.status))throw Error('Browser preflight must succeed before the project hook');
  connected(environment);await environment.session.revalidate();
  if(!reference){await recorder.append({stage:'project',status:'PASS',reason:'No project hook configured',observations:{hook:null,started,ended:Date.now()},evidence:[],cleanupErrors:[]});return;}
  validateReference(reference);
  if(!isAbsolute(projectRoot))throw Error('Explicit absolute project root required');
  const root=realpathSync(projectRoot),entry=confinedPath(root,reference.entry);
  const digest=sha256(readFileSync(entry));if(digest!==reference.sha256)throw Error('Project preflight hook entry digest mismatch');
  const evidenceDirectory=join(resolve(recorder.root),`project-preflight-${sha256(recorder.identity.executionId)}-${recorder.workerIndex}`);await mkdir(evidenceDirectory,{recursive:true});
  const result=await bounded(async(hookSignal)=>{
   const module=await import(pathToFileURL(entry).href+'?sha256='+digest);
   if(module.contractVersion!==1||typeof module.runPreflight!=='function')throw Error('Unsupported project preflight module version/export');
   const context:ProjectPreflightContext={contractVersion:1,projectRoot:root,environmentId:recorder.environmentId,executionIdentity:structuredClone(recorder.identity),browser:environment.browser,browserProvenance:structuredClone(environment.provenance),input:structuredClone(reference.input),evidenceDirectory,deadlineMs:reference.deadlineMs,signal:hookSignal};
   const value:unknown=await module.runPreflight(context);validateHookResult(value);
   for(const e of value.evidence){if(sha256(readFileSync(confinedPath(evidenceDirectory,e.path)))!==e.sha256)throw Error('Hook evidence digest mismatch');}
   return {...value,evidence:value.evidence.map(e=>({...e,path:confinedPath(evidenceDirectory,e.path)}))};
  },reference.deadlineMs,signal);
  connected(environment);await environment.session.revalidate();
  await recorder.append({stage:'project',status:result.status==='READY'?'PASS':'BLOCKED',reason:result.reason,observations:{hook:{entry:reference.entry,sha256:digest,inputDigest:sha256(JSON.stringify(reference.input)),status:result.status,...(result.hitl?{hitl:result.hitl}:{})},started,ended:Date.now()},evidence:result.evidence,cleanupErrors:[]});
  if(result.status!=='READY'){await recorder.blocked('target',result.status+': '+result.reason);throw Error(result.status+': '+result.reason);}
 }catch(error){
  if(recorder.records.at(-1)?.stage!=='gate')await recorder.blocked('project',error);
  throw error;
 }
}
export interface TargetPreflightOptions {pageUrl:string;deadlineMs:number;assignment:Assignment;planBytes:string;claimIds:string[];testKey?:string;signal?:AbortSignal}
// dispose is for explicitly authorized baseline reset/session termination, not proof teardown.
export interface ReadyTarget {page:Page;targetId:string;created:boolean;dispose():Promise<void>}
export async function targetPreflight(environment:BrowserEnvironment,recorder:PreflightRecorder,options:TargetPreflightOptions):Promise<ReadyTarget>{
 let page:Page|undefined,created=false;const started=Date.now(),cleanupErrors:string[]=[];
 const dispose=async()=>{if(created&&page&&!page.isClosed()&&options.assignment.ownership.cleanup.includes('target'))await page.close({runBeforeUnload:false});};
 try{
  if(!['PASS','RECOVERED'].includes(recorder.records[0]?.status)||recorder.records[1]?.status!=='PASS'||recorder.records.at(-1)?.status==='PREFLIGHT_BLOCKED')throw Error('Browser/project preflight must succeed before target setup');
  const plan:Plan=JSON.parse(options.planBytes);
  if(validateSchema('browser-verification-plan',plan).length||validateSchema('assignment',options.assignment).length||sha256(options.planBytes)!==recorder.identity.planDigest||sha256(JSON.stringify(options.assignment))!==recorder.identity.assignmentDigest||options.assignment.authorization.planDigest!==recorder.identity.planDigest||options.assignment.authorization.bindingDigest!==recorder.identity.bindingDigest)throw Error('Current target setup authorization is not authorized');
  const selected=options.assignment.environments.filter(e=>e.id===recorder.environmentId);
  if(selected.length!==1||selected[0].selection.pageUrl!==options.pageUrl||!options.pageUrl)throw Error('Explicit assigned page URL/environment required');
  const result=await bounded(async(signal)=>{
   connected(environment);await environment.session.revalidate();
   const contexts=environment.browser.contexts(),matches=contexts.flatMap(c=>c.pages()).filter(p=>!p.isClosed()&&p.url()===options.pageUrl);
   if(matches.length>1)throw Error('Assigned page must match exactly once; ambiguous targets');
   page=matches[0];
   if(!page){
    const claims=plan.claims.filter(c=>options.claimIds.includes(c.id)&&c.environmentIds.includes(recorder.environmentId));
    if(!claims.length||claims.length!==new Set(options.claimIds).size||['target-create','target-navigate'].some(e=>!options.assignment.authorization.allowedEffects.includes(e)||claims.some(c=>!c.allowedEffects.includes(e))))throw Error('Target creation/navigation is not authorized');
    if(!options.assignment.ownership.disposable.includes('target'))throw Error('Created target must be assigned disposable ownership');
    if(contexts.length!==1)throw Error('Unique assigned persistent context required');
    if(signal.aborted)throw Error('Target preflight cancelled');
    page=await contexts[0].newPage();created=true;
    if(signal.aborted)throw Error('Target preflight cancelled after creation');
    await page.goto(options.pageUrl,{waitUntil:'domcontentloaded',timeout:Math.max(1,options.deadlineMs-(Date.now()-started))});
   }
   const current=page;
   await current.waitForLoadState('domcontentloaded',{timeout:Math.max(1,options.deadlineMs-(Date.now()-started))});
   if(signal.aborted||current.isClosed()||current.url()!==options.pageUrl)throw Error('Assigned target lost or final URL mismatch');
   const cdp=await current.context().newCDPSession(current);
   let targetId:string;
   try{const {targetInfo}=await cdp.send('Target.getTargetInfo');if(!targetInfo?.targetId||targetInfo.type!=='page'||targetInfo.url!==options.pageUrl)throw Error('Fresh assigned page target identity required');targetId=targetInfo.targetId;}finally{await cdp.detach();}
   connected(environment);await environment.session.revalidate();
   return {page:current,targetId,created,dispose};
  },options.deadlineMs,options.signal);
  await recorder.append({stage:'target',status:created?'CREATED':'PASS',reason:created?'Required target created, navigated and ready':'Exact required live target reused and ready',...(options.testKey?{testKey:options.testKey}:{}),observations:{targetId:result.targetId,pageUrl:options.pageUrl,ownership:created?'disposable':'borrowed',started,ended:Date.now()},evidence:[],cleanupErrors:[]});
  return result;
 }catch(error){
  // Retain partial observable setup state too; cleanup is an explicit lifecycle action.
  const failure=Object.assign(new Error(detail(error),{cause:error}),{cleanupErrors,raw:{created,pageUrl:options.pageUrl,ownership:created?'disposable':'borrowed',started,ended:Date.now()}});
  await recorder.blocked(recorder.records.at(-1)?.stage==='target'?'gate':'target',failure,options.testKey);throw failure;
 }
}
export async function environmentReady(environment:BrowserEnvironment,target:ReadyTarget,recorder:PreflightRecorder,options:Pick<TargetPreflightOptions,'pageUrl'|'testKey'|'deadlineMs'|'signal'>){
 try {
 await bounded(async()=>{
  connected(environment);await environment.session.revalidate();
  if(target.page.isClosed()||target.page.url()!==options.pageUrl||target.page.context().browser()!==environment.browser)throw Error('Assigned target/browser identity changed before READY');
  const matches=environment.browser.contexts().flatMap(c=>c.pages()).filter(p=>!p.isClosed()&&p.url()===options.pageUrl);
  if(matches.length!==1||matches[0]!==target.page)throw Error('Assigned target selection changed before READY');
  const session=await target.page.context().newCDPSession(target.page);
  try{const {targetInfo}=await session.send('Target.getTargetInfo');if(targetInfo?.targetId!==target.targetId||targetInfo.url!==options.pageUrl)throw Error('Assigned target incarnation changed before READY');}finally{await session.detach();}
  const collected=collectPreflight(recorder.root,recorder.identity);
  const persisted=collected.records.filter(r=>r.workerIndex===recorder.workerIndex).sort((a,b)=>a.sequence-b.sequence);
  const errors=[...collected.errors,...validatePreflightOrder(recorder.records),...recorder.records.flatMap(r=>validatePreflightRecord(r,recorder.root,recorder.identity))];
  if(JSON.stringify(persisted)!==JSON.stringify(recorder.records))errors.push('Flushed preflight records changed or missing');
  if(errors.length||!['PASS','RECOVERED'].includes(recorder.records[0]?.status)||recorder.records[1]?.status!=='PASS'||!['PASS','CREATED'].includes(recorder.records.at(-1)?.status??''))throw Error('Preflight evidence/stages not ready: '+errors.join('; '));
 },options.deadlineMs,options.signal);
 if(options.signal?.aborted)throw Error('Preflight cancelled before READY');
 connected(environment);if(target.page.isClosed()||target.page.url()!==options.pageUrl)throw Error('Assigned target lost before READY');
 await recorder.append({stage:'gate',status:'ENVIRONMENT READY',reason:'Current browser, project and target preflight established',...(options.testKey?{testKey:options.testKey}:{}),observations:{browser:JSON.parse(JSON.stringify(environment.provenance)),targetId:target.targetId,pageUrl:options.pageUrl},evidence:[],cleanupErrors:[]});
 }catch(error){await recorder.blocked('gate',error,options.testKey);throw error;}
}
