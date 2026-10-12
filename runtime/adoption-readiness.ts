import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,realpathSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Reporter,FullConfig,FullResult,TestCase,TestResult} from '@playwright/test/reporter';
import type {Binding,Assignment,ExecutionIdentity,Invocation,Plan,Verdict} from '../src/contracts/index.js';
import type {PreflightOptions,ReadinessSelection,HookDecision} from './preflight.js';
import {sha256,type ResolutionConfig} from '../src/resources/resolve.js';
import {validatePlan} from '../src/validation/plan.js';
import {discoverProviders} from '../src/compilation/bundle.js';
import {sourceDigest} from '../src/validation/result.js';
import {collectPreflight,confinedPath} from './evidence/readiness.js';
import {boundedProcess} from './host/wsl-windows/process.js';

export function validateHookDecision(decision:HookDecision):void {
 if(!decision||!['HookRequired','HookNotRequired','Unresolved'].includes(decision.state)||!decision.rationale?.trim()||!Array.isArray(decision.sourceRefs)||!decision.sourceRefs.length||decision.sourceRefs.some(s=>typeof s!=='string'||!s.trim())||!/^[a-f0-9]{64}$/.test(decision.inputFingerprint))throw Error('Explicit source-backed hook decision required');
}
export function validateReadinessSelection(options:PreflightOptions):void {
 const selection=options.readiness;
 if(!selection||options.manifest||!selection.testKey?.trim()||!/^[a-f0-9]{64}$/.test(selection.configurationFingerprint))throw Error('Explicit readiness-only selection required');
 validateHookDecision(selection.hookDecision);
 if(selection.hookDecision.state==='Unresolved')throw Error('Hook decision is unresolved');
 if((selection.hookDecision.state==='HookRequired')!==!!options.projectPreflightHook)throw Error('Hook decision differs from configured consumer hook; reconcile before probing');
 const plan:Plan=JSON.parse(options.planBytes);
 if(!Array.isArray(selection.claimIds)||!selection.claimIds.length||new Set(selection.claimIds).size!==selection.claimIds.length||selection.claimIds.some(id=>!plan.claims.some(c=>c.id===id&&c.environmentIds.includes(options.environmentId))))throw Error('Readiness selection must name existing applicable claims');
}

export interface ReadinessRequest {
 cwd:string;planPath:string;binding:Binding;resolution:ResolutionConfig;assignment:Assignment;
 environmentId:string;claimIds:string[];hookDecision:HookDecision;
 inputFingerprint:string;
 runnerEntry:string;probePath:string;projectName?:string;requiredFixtures?:string[];
 sources?:{path:string;sha256:string}[];
 executionId?:string;attempt?:number;deadlineMs:number;
}
export interface PreparedReadiness extends ReadinessRequest {
 identity:ExecutionIdentity;planBytes:string;testKey:string;outputRoot:string;probePath:string;summaryPath:string;sources:{path:string;sha256:string}[];
}
export interface ReadinessSummary {
 schemaVersion:1;purpose:'consumer-readiness';identity:ExecutionIdentity;
 configurationFingerprint:string|null;outcome:Verdict;reason:string;
 inputFingerprint:string;
 runner:{status:string;exitCode:number|null};entry?:{exitCode:number|null;timedOut:boolean};evidence:string[];limitations:string[];
 sources?:{path:string;sha256:string}[];
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const describe=(error:unknown)=>error instanceof Error?error.message:String(error);
function integrationRoot(cwd:string):string {
 const expected=resolve(cwd,'.verification/integration'),actual=confinedPath(cwd,expected);
 if(actual!==expected)throw Error('Integration directory escapes its owned namespace');
 return actual;
}

// Validate concrete generated configuration; never import or compose native modules.
export function recordReadinessConfiguration(request:PreparedReadiness,use:{preflight?:PreflightOptions;hostConfig?:{runtimeConfig?:string;powershell?:string;launch?:boolean};pageUrl?:string},projectName?:string):ReadinessSelection {
 const previous=use.preflight;
 const environment=request.assignment.environments.find(e=>e.id===request.environmentId)!;
 if(!previous||previous.projectRoot!==request.cwd||previous.environmentId!==request.environmentId||!same(previous.assignment,request.assignment)||previous.planBytes!==request.planBytes)throw Error('Consumer preflight differs from current assigned inputs');
 if(use.hostConfig?.runtimeConfig!==environment.runtimeConfig||use.hostConfig?.powershell!==environment.powershell||use.hostConfig?.launch!==environment.launch||use.pageUrl!==environment.selection.pageUrl)throw Error('Consumer host/target configuration differs from assignment');
 if(request.projectName&&projectName!==request.projectName)throw Error('Readiness runner project differs from selection');
 if(previous.projectPreflightHook)confinedPath(integrationRoot(request.cwd),resolve(request.cwd,previous.projectPreflightHook.entry));
 const paths=[...request.sources.map(s=>s.path),resolve(request.cwd,environment.runtimeConfig),...(previous.projectPreflightHook?[resolve(request.cwd,previous.projectPreflightHook.entry)]:[])];
 const sources=[...new Set(paths)].map(path=>({path:confinedPath(request.cwd,path),sha256:sha256(readFileSync(path))}));
 if(request.sources.some(source=>!sources.some(s=>s.path===source.path&&s.sha256===source.sha256)))throw Error('Readiness inputs changed before runner configuration');
 const fingerprint=sha256(JSON.stringify({sources,hostConfig:use.hostConfig,pageUrl:use.pageUrl,hook:previous.projectPreflightHook??null,project:projectName??null,fixtures:request.requiredFixtures??[],assignment:request.identity.assignmentDigest}));
 const readiness:ReadinessSelection={testKey:request.testKey,claimIds:request.claimIds,hookDecision:request.hookDecision,configurationFingerprint:fingerprint};
 if(previous.manifest)throw Error('Product manifest forbidden in readiness configuration');
 validateReadinessSelection({projectRoot:previous.projectRoot,environmentId:previous.environmentId,assignment:previous.assignment,planBytes:previous.planBytes,projectPreflightHook:previous.projectPreflightHook,readiness});
 const effective={identity:request.identity,selection:readiness,sources,projectPreflightHook:previous.projectPreflightHook??null};
 const effectivePath=join(request.outputRoot,'effective.json');
 if(existsSync(effectivePath)){if(!same(JSON.parse(readFileSync(effectivePath,'utf8')),effective))throw Error('Consumer configuration changed between runner and worker');}
 else writeFileSync(effectivePath,JSON.stringify(effective),{flag:'wx'});
 return readiness;
}

export default class ReadinessReporter implements Reporter {
 private matched=0;private errors:string[]=[];
 constructor(private request:PreparedReadiness){}
 onBegin(config:FullConfig,suite:import('@playwright/test/reporter').Suite){
  if(suite.allTests().length!==1)this.errors.push('Readiness must collect exactly one probe');
  if(config.workers!==1||config.fullyParallel||config.shard||config.projects.length!==1||config.projects.some(p=>('fullyParallel' in p&&p.fullyParallel)||p.retries!==0||p.repeatEach!==1))this.errors.push('Readiness requires one serial worker and zero retries');
  try{recordReadinessConfiguration(this.request,config.projects[0].use as {preflight?:PreflightOptions;hostConfig?:{runtimeConfig?:string;powershell?:string;launch?:boolean};pageUrl?:string},config.projects[0].name);}catch(error){this.errors.push(describe(error));}
 }
 onTestEnd(test:TestCase,result:TestResult){
  if(resolve(test.location.file)!==this.request.probePath||test.annotations.filter(a=>a.type==='testKey'&&a.description===this.request.testKey).length!==1)this.errors.push('Unexpected readiness test/source');
  else if(result.status==='passed')this.matched++;
  this.errors.push(...result.errors.map(e=>e.message??String(e)));
  if(result.attachments.some(a=>a.name.startsWith('claim-')||a.name.startsWith('evidence-')))this.errors.push('Product records are forbidden in readiness-only execution');
 }
 onEnd(result:FullResult){
  const collected=collectPreflight(join(this.request.outputRoot,'records'),this.request.identity);
  this.errors.push(...collected.errors,...collected.records.flatMap(r=>r.cleanupErrors));
  let fingerprint:string|null=null;let sources:{path:string;sha256:string}[]=[];
  try{
   const effective=JSON.parse(readFileSync(join(this.request.outputRoot,'effective.json'),'utf8'));
   const receipt=JSON.parse(readFileSync(join(this.request.outputRoot,'records','readiness-fixture.json'),'utf8'));
   if(!same(receipt,{identity:effective.identity,selection:effective.selection})||!same(receipt.identity,this.request.identity))throw Error('Actual configured fixture did not acknowledge readiness inputs');
   sources=effective.sources;
   if(!Array.isArray(sources)||this.request.sources.some(source=>!sources.some(s=>same(s,source))))throw Error('Current readiness source identities missing');
   validateReadinessSelection({projectRoot:this.request.cwd,environmentId:this.request.environmentId,assignment:this.request.assignment,planBytes:this.request.planBytes,readiness:effective.selection,projectPreflightHook:effective.projectPreflightHook??undefined});
   if(effective.selection.testKey!==this.request.testKey||!same(effective.selection.claimIds,this.request.claimIds)||!same(effective.selection.hookDecision,this.request.hookDecision))throw Error('Effective readiness selection changed');
   if(sources.some(source=>sha256(readFileSync(source.path))!==source.sha256))throw Error('Consumer readiness source/configuration changed');
   fingerprint=effective.selection.configurationFingerprint;
   const records=collected.records;
   if(records.length!==4||!same(records.map(r=>r.stage),['browser','project','target','gate'])||records.some(r=>r.environmentId!==this.request.environmentId)||records[2].testKey!==this.request.testKey||records[3].testKey!==this.request.testKey)throw Error('Complete current readiness sequence required');
   const project=records[1].observations as any;
   if(this.request.hookDecision.state==='HookRequired'&&(!project.hook||project.hook.status!=='READY'||project.hook.entry!==effective.projectPreflightHook?.entry||project.hook.sha256!==effective.projectPreflightHook?.sha256||project.hook.inputDigest!==sha256(JSON.stringify(effective.projectPreflightHook?.input))||!records[1].evidence.length))throw Error('Required consumer hook readiness evidence missing');
   if(this.request.hookDecision.state==='HookNotRequired'&&project.hook!==null)throw Error('Deliberate no-hook path was not exercised');
  }catch(error){this.errors.push(describe(error));}
  const blocked=collected.records.some(r=>r.status==='PREFLIGHT_BLOCKED'||r.status==='BLOCKED');
  const ready=collected.records.at(-1)?.status==='ENVIRONMENT READY';
  const outcome:Verdict=blocked?'BLOCKED':result.status==='passed'&&this.matched===1&&ready&&!this.errors.length?'PASS':'INCONCLUSIVE';
  const summary:ReadinessSummary={schemaVersion:1,purpose:'consumer-readiness',identity:this.request.identity,inputFingerprint:this.request.inputFingerprint,configurationFingerprint:fingerprint,outcome,
   reason:outcome==='PASS'?'Actual consumer fixture reached ENVIRONMENT READY and runner completed normally':(collected.records.find(r=>r.status==='BLOCKED')?.reason??(this.errors.join('; ')||'Readiness completion unestablished')),
   runner:{status:result.status,exitCode:null},evidence:collected.paths,limitations:this.errors,sources};
  writeFileSync(this.request.summaryPath,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 }
}

export async function invokeReadiness(input:ReadinessRequest):Promise<ReadinessSummary> {
 const cwd=realpathSync(resolve(input.cwd)),planBytes=readFileSync(resolve(cwd,input.planPath),'utf8');
 const validation=validatePlan({planBytes,binding:input.binding,resolution:{...input.resolution,mode:'execution'},projectRoot:cwd,assignment:input.assignment});
 if(!validation.valid)throw Error('Readiness inputs blocked: '+validation.diagnostics.map(d=>d.message).join('; '));
 validateHookDecision(input.hookDecision);
 if(input.hookDecision.inputFingerprint!==input.inputFingerprint||!/^[a-f0-9]{64}$/.test(input.inputFingerprint))throw Error('Hook assessment input fingerprint changed');
 if(input.hookDecision.state==='Unresolved')throw Error('Hook decision is unresolved');
 if(!Number.isFinite(input.deadlineMs)||input.deadlineMs<=0)throw Error('Positive readiness invocation deadline required');
 const environment=input.assignment.environments.filter(e=>e.id===input.environmentId);
 if(environment.length!==1||!environment[0].exclusive)throw Error('Exclusive assigned readiness environment required');
 const integration=integrationRoot(cwd);
 const owned=(path:string)=>confinedPath(integration,resolve(cwd,path));
 const runnerEntry=owned(input.runnerEntry),probePath=owned(input.probePath);
 owned(input.assignment.fixtureEntry);owned(input.assignment.runnerConfig);
 input.assignment.providers.forEach(p=>owned(p.entry));
 const invocation:Invocation={schemaVersion:1,planPath:input.planPath,planDigest:validation.planDigest,binding:input.binding,assignment:input.assignment};
 const discovered=await discoverProviders(invocation,cwd);
 if(discovered.diagnostics.length)throw Error('Configured provider discovery blocked: '+discovered.diagnostics.join('; '));
 const plan:Plan=JSON.parse(planBytes);
 if(!Array.isArray(input.claimIds)||!input.claimIds.length||new Set(input.claimIds).size!==input.claimIds.length||input.claimIds.some(id=>!plan.claims.some(c=>c.id===id&&c.environmentIds.includes(input.environmentId))))throw Error('Readiness selection must name existing applicable claims');
 const requiredCapabilities=plan.claims.filter(c=>input.claimIds.includes(c.id)&&c.environmentIds.includes(input.environmentId)).flatMap(c=>c.proof.filter(p=>p.mandatory&&p.capabilityId));
 if(requiredCapabilities.some(proof=>!discovered.providers.some(p=>p.capabilities.some(c=>c.id===proof.capabilityId&&c.contractVersion===proof.capabilityVersion&&c.support==='established'))))throw Error('Required configured callable capability is missing or unestablished');
 const paths=[runnerEntry,probePath,owned(input.assignment.fixtureEntry),owned(input.assignment.runnerConfig),...discovered.sources.flatMap(p=>[owned(p.entry),owned(p.declarations)])];
 const sources=[...new Set([...paths,...(input.sources??[]).map(source=>confinedPath(cwd,source.path))])].map(path=>({path,sha256:sha256(readFileSync(path))}));
 if(input.sources?.some(source=>sha256(readFileSync(confinedPath(cwd,source.path)))!==source.sha256))throw Error('Declared readiness source identity changed');
 const executionId=input.executionId??randomUUID(),attempt=input.attempt??1;
 if(!Number.isInteger(attempt)||attempt<1)throw Error('Positive explicit attempt required');
 const parent=resolve(cwd,input.assignment.outputDirectory);
 if(parent===cwd||relative(cwd,parent).startsWith('..')||isAbsolute(relative(cwd,parent)))throw Error('Readiness output must be inside the assigned consumer output directory');
 const retained=resolve(cwd,'.verification/adoption-evidence');
 const retainedRelative=relative(retained,parent);
 if(retainedRelative==='..'||retainedRelative.startsWith('../')||isAbsolute(retainedRelative))throw Error('Readiness output must be under .verification/adoption-evidence');
 if(!existsSync(retained))mkdirSync(retained);
 if(confinedPath(cwd,retained)!==retained)throw Error('Readiness evidence directory escapes its retained namespace');
 let ancestor=parent;
 while(!existsSync(ancestor))ancestor=dirname(ancestor);
 if(ancestor!==retained)confinedPath(retained,ancestor);
 const outputRoot=join(parent,'adoption-readiness',sha256(executionId)+'-'+attempt);
 if(existsSync(outputRoot))throw Error('Readiness attempt already exists; inspect terminal evidence, never relaunch');
 mkdirSync(outputRoot,{recursive:true});confinedPath(cwd,outputRoot);
 const summaryPath=join(outputRoot,'readiness.json');
 const testKey='adoption-readiness:'+executionId+':'+attempt;
 const identity:ExecutionIdentity={executionId,attempt,planDigest:validation.planDigest,bindingDigest:validation.bindingDigest,assignmentDigest:sha256(JSON.stringify(input.assignment)),generatedSourceDigest:sourceDigest(cwd,[relative(cwd,probePath)]),fixtureDigest:sha256(readFileSync(resolve(cwd,input.assignment.fixtureEntry))),providerSources:discovered.sources,providers:input.assignment.providers.map(({id,version})=>({id,version})),provenance:{runtime:'adoption-readiness',build:environment[0].build,tools:{node:process.version}}};
 const request:PreparedReadiness={...input,cwd,runnerEntry,identity,planBytes,testKey,outputRoot,probePath,summaryPath,sources};
 const requestPath=join(outputRoot,'request.json');
 writeFileSync(requestPath,JSON.stringify(request),{flag:'wx'});
 const run=await boundedProcess(process.execPath,[runnerEntry,requestPath],input.deadlineMs,true,undefined,cwd);
 let summary:ReadinessSummary;
 try{summary=JSON.parse(readFileSync(summaryPath,'utf8'));if(!same(summary.identity,identity)||summary.purpose!=='consumer-readiness'||summary.inputFingerprint!==input.inputFingerprint)throw Error('Readiness summary identity mismatch');}
 catch(error){summary={schemaVersion:1,purpose:'consumer-readiness',identity,inputFingerprint:input.inputFingerprint,configurationFingerprint:null,outcome:'BLOCKED',reason:'Readiness report unavailable: '+describe(error),runner:{status:'incomplete',exitCode:null},evidence:[],limitations:[run.stdout,run.stderr]};}
 summary.entry={exitCode:run.exitCode,timedOut:run.timedOut};
 if(summary.runner.status!=='passed'||summary.runner.exitCode!==0){summary.outcome=summary.outcome==='BLOCKED'?'BLOCKED':'INCONCLUSIVE';summary.reason='Actual readiness runner did not complete successfully';summary.limitations.push(summary.reason);}
 if(run.exitCode!==0||run.timedOut){summary.outcome=summary.outcome==='BLOCKED'?'BLOCKED':'INCONCLUSIVE';summary.reason=run.timedOut?'Generated readiness entry interrupted':'Generated readiness entry did not exit successfully';summary.limitations.push(run.stderr,summary.reason);}
 if(identity.fixtureDigest!==sha256(readFileSync(resolve(cwd,input.assignment.fixtureEntry)))||identity.generatedSourceDigest!==sourceDigest(cwd,[relative(cwd,probePath)])){summary.outcome='BLOCKED';summary.reason='Readiness source changed during execution';}
 if(sources.some(source=>sha256(readFileSync(source.path))!==source.sha256)||summary.sources?.some(source=>sha256(readFileSync(source.path))!==source.sha256)){summary.outcome='BLOCKED';summary.reason='Readiness configuration changed during execution';}
 const productFiles=(dir:string):boolean=>readdirSync(dir,{withFileTypes:true}).some(e=>e.isDirectory()?productFiles(join(dir,e.name)):/^(claim-|evidence-)/.test(e.name));
 if(existsSync(join(outputRoot,'records'))&&productFiles(join(outputRoot,'records'))){summary.outcome='BLOCKED';summary.reason='Product evidence found in readiness-only output';}
 writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n');
 return summary;
}
