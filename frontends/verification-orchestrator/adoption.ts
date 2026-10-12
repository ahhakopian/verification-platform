import {mkdirSync,readFileSync,writeFileSync,renameSync,unlinkSync,existsSync,realpathSync,openSync,closeSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Binding,Verdict} from '../../src/contracts/index.js';
import type {HookDecision} from '../../runtime/preflight.js';
import {validateHookDecision} from '../../runtime/adoption-readiness.js';
import {sha256,resolveResources,type ResolutionConfig} from '../../src/resources/resolve.js';
import {validateSchema} from '../../src/validation/schema.js';
import {confinedPath,collectPreflight} from '../../runtime/evidence/readiness.js';

export type AdoptionStage='INSTALL / UPGRADE'|'CONFIGURE CONSUMER'|'PLATFORM SELF-CHECK'|'CONSUMER READINESS PROBE'|'ADOPTION ASSESSMENT'|'PASS';
export interface AdoptionEvidence {path:string;sha256:string}
export interface AdoptionDispatch {executionId:string;attempt:number;kind:'self-check'|'readiness'|'correction';inputFingerprint:string;commandFingerprint:string;status:'reserved'|'running';handle:string|null}
export interface AdoptionResolutionOption {id:string;action:'continue'|'cancel';description:string}
export interface AdoptionHITL {action:string;reason:string;scope:string;authorizationReference:string;options:AdoptionResolutionOption[]}
export interface AdoptionResolution {option:AdoptionResolutionOption;requestReference:string;decisionReference:string}
export interface AdoptionCheckpoint {
 formatVersion:1;consumerRoot:string;binding:Binding;inputFingerprint:string;
 stage:AdoptionStage;status:'active'|'waiting'|'blocked'|'completed'|'cancelled';hookDecision:HookDecision;
 lastCheck:{executionId:string;attempt:number;kind:'self-check'|'readiness';outcome:Verdict;evidence:AdoptionEvidence}|null;
 activeDispatch:AdoptionDispatch|null;
 pendingHITL:AdoptionHITL|null;
 resolution?:AdoptionResolution|null;
 defect:{id:string;evidence:AdoptionEvidence;correction:'reserved'|'applied';beforeFingerprint:string;afterFingerprint:string|null}|null;
 assessment:AdoptionEvidence|null;
}
const stages:AdoptionStage[]=['INSTALL / UPGRADE','CONFIGURE CONSUMER','PLATFORM SELF-CHECK','CONSUMER READINESS PROBE','ADOPTION ASSESSMENT','PASS'];
const hash=(value:string)=>/^[a-f0-9]{64}$/.test(value);
const nonempty=(value:unknown):value is string=>typeof value==='string'&&!!value.trim();
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const reference=(value:any)=>value&&nonempty(value.path)&&hash(value.sha256);
function validateResolutionOption(option:AdoptionResolutionOption):void {
 if(!option||!nonempty(option.id)||!nonempty(option.description)||!['continue','cancel'].includes(option.action))throw Error('Concrete resolution option required');
}
export function validateAdoptionCheckpoint(value:AdoptionCheckpoint,consumerRoot:string,binding:Binding,inputFingerprint:string):void {
 if(!value||['formatVersion','consumerRoot','binding','inputFingerprint','stage','status','hookDecision','lastCheck','activeDispatch','pendingHITL','defect','assessment'].some(key=>!Object.hasOwn(value,key)))throw Error('Incomplete adoption checkpoint');
 if(value.formatVersion!==1||value.consumerRoot!==realpathSync(consumerRoot)||!same(value.binding,binding)||validateSchema('binding',value.binding).length||value.inputFingerprint!==inputFingerprint||!hash(inputFingerprint))throw Error('Checkpoint format/root/release/input changed; reassessment required');
 if(!stages.includes(value.stage)||!['active','waiting','blocked','completed','cancelled'].includes(value.status))throw Error('Invalid checkpoint stage/status');
 validateHookDecision(value.hookDecision);
 if(value.activeDispatch){const d=value.activeDispatch;if(!nonempty(d.executionId)||!Number.isInteger(d.attempt)||d.attempt<1||!['self-check','readiness','correction'].includes(d.kind)||!hash(d.inputFingerprint)||!hash(d.commandFingerprint)||!['reserved','running'].includes(d.status)||(d.handle!==null&&!nonempty(d.handle))||(d.status==='running'&&!d.handle))throw Error('Invalid active dispatch');}
 if(value.lastCheck&&(!reference(value.lastCheck.evidence)||!nonempty(value.lastCheck.executionId)||!Number.isInteger(value.lastCheck.attempt)||value.lastCheck.attempt<1||!['self-check','readiness'].includes(value.lastCheck.kind)||!['PASS','FAIL','BLOCKED','INCONCLUSIVE'].includes(value.lastCheck.outcome)))throw Error('Invalid last check reference');
 if(value.pendingHITL){
  if(value.status!=='waiting')throw Error('Pending HITL requires waiting status');
  const request=value.pendingHITL;
  if(![request.action,request.reason,request.scope,request.authorizationReference].every(nonempty))throw Error('Explicit HITL action/reason/scope/authorization reference required');
  if(!Array.isArray(request.options)||request.options.length<2)throw Error('HITL requires viable resolution options and explicit cancellation');
  request.options.forEach(validateResolutionOption);
  if(new Set(request.options.map(o=>o.id)).size!==request.options.length||request.options.filter(o=>o.action==='cancel').length!==1||!request.options.some(o=>o.action==='continue'))throw Error('HITL requires distinct resolution options and explicit cancellation');
  if(request.options.find(o=>o.action==='cancel')!.description!=='Cancel Verifier installation')throw Error('Cancellation option must be labelled Cancel Verifier installation');
 }
 if(value.resolution){validateResolutionOption(value.resolution.option);if(!nonempty(value.resolution.requestReference)||!nonempty(value.resolution.decisionReference))throw Error('Explicit user decision reference required');}
 if(value.defect&&(!nonempty(value.defect.id)||!reference(value.defect.evidence)||!['reserved','applied'].includes(value.defect.correction)||!hash(value.defect.beforeFingerprint)||(value.defect.afterFingerprint!==null&&!hash(value.defect.afterFingerprint))))throw Error('Invalid diagnosed correction');
 if(value.assessment&&!reference(value.assessment))throw Error('Invalid assessment reference');
 if(value.status==='waiting'&&!value.pendingHITL)throw Error('Waiting requires pending HITL');
 if(value.status==='completed'&&(value.stage!=='PASS'||!value.assessment||value.pendingHITL||value.activeDispatch||value.hookDecision.state==='Unresolved'))throw Error('Adoption completion requires assessment and resolved state');
 if(value.status==='cancelled'&&(value.resolution?.option.action!=='cancel'||value.pendingHITL))throw Error('Installation cancellation requires explicit user choice');
 if(value.resolution?.option.action==='cancel'&&value.status!=='cancelled')throw Error('Cancelled installation cannot resume');
}
export function createAdoptionCheckpoint(consumerRoot:string,binding:Binding,inputFingerprint:string):AdoptionCheckpoint {
 const value:AdoptionCheckpoint={formatVersion:1,consumerRoot:realpathSync(consumerRoot),binding,inputFingerprint,stage:'INSTALL / UPGRADE',status:'active',hookDecision:{state:'Unresolved',rationale:'Applicable consumer obligations have not yet been assessed',sourceRefs:['installation/adoption instructions'],inputFingerprint},lastCheck:null,activeDispatch:null,pendingHITL:null,defect:null,assessment:null};
 validateAdoptionCheckpoint(value,consumerRoot,binding,inputFingerprint);return value;
}
export function readAdoptionCheckpoint(consumerRoot:string,binding:Binding,inputFingerprint:string):{checkpoint:AdoptionCheckpoint;digest:string} {
 const path=confinedPath(consumerRoot,'.verification/adoption.json'),bytes=readFileSync(path);
 const checkpoint=JSON.parse(bytes.toString());validateAdoptionCheckpoint(checkpoint,consumerRoot,binding,inputFingerprint);
 if(checkpoint.status==='completed')validateAdoptionAssessment(checkpoint,JSON.parse(readFileSync(evidencePath(consumerRoot,checkpoint.assessment),'utf8')));
 return {checkpoint,digest:sha256(bytes)};
}
// Compare-and-swap plus a short exclusive lock; stale locks require explicit reconciliation.
export function writeAdoptionCheckpoint(checkpoint:AdoptionCheckpoint,expectedDigest:string|null):string {
 validateAdoptionCheckpoint(checkpoint,checkpoint.consumerRoot,checkpoint.binding,checkpoint.inputFingerprint);
 const directory=join(checkpoint.consumerRoot,'.verification');mkdirSync(directory,{recursive:true});confinedPath(checkpoint.consumerRoot,directory);
 const path=join(directory,'adoption.json'),lock=join(directory,'adoption.lock');
 const fd=openSync(lock,'wx');const temporary=join(directory,'adoption-'+randomUUID()+'.tmp');
 try{
  if(existsSync(path))confinedPath(checkpoint.consumerRoot,path);
  const currentBytes=existsSync(path)?readFileSync(path):null;
  const current=currentBytes?sha256(currentBytes):null;
  if(current!==expectedDigest)throw Error('Checkpoint changed or belongs to an active workflow; do not overwrite');
  if(currentBytes){
   const persisted:AdoptionCheckpoint=JSON.parse(currentBytes.toString());
   if(persisted.status==='cancelled'&&checkpoint.status!=='cancelled')throw Error('Persisted cancelled workflow is terminal; do not reopen');
   if(persisted.pendingHITL&&!same(persisted.pendingHITL,checkpoint.pendingHITL)){
    // Persist the offered decision separately before any subsequent request.
    const resolution=checkpoint.resolution;
    if(checkpoint.pendingHITL||!resolution||same(persisted.resolution,resolution)||
       resolution.requestReference!==persisted.pendingHITL.authorizationReference||
       !persisted.pendingHITL.options.some(option=>same(option,resolution.option)))
     throw Error('Persisted pending HITL requires its matching recorded resolution before clearing or replacement');
   }
  }
  if(checkpoint.status==='completed')validateAdoptionAssessment(checkpoint,JSON.parse(readFileSync(evidencePath(checkpoint.consumerRoot,checkpoint.assessment!),'utf8')));
  const bytes=JSON.stringify(checkpoint,null,2)+'\n';writeFileSync(temporary,bytes,{flag:'wx'});renameSync(temporary,path);return sha256(bytes);
 }finally{closeSync(fd);unlinkSync(lock);if(existsSync(temporary))unlinkSync(temporary);}
}
export function reserveAdoptionDispatch(checkpoint:AdoptionCheckpoint,dispatch:Omit<AdoptionDispatch,'status'|'handle'>):AdoptionCheckpoint {
 if(checkpoint.activeDispatch||checkpoint.pendingHITL||checkpoint.status!=='active')throw Error('Active/pending dispatch must be reconciled before a new operation');
 if(dispatch.inputFingerprint!==checkpoint.inputFingerprint)throw Error('Dispatch inputs changed');
 if(checkpoint.lastCheck?.executionId===dispatch.executionId&&checkpoint.lastCheck.attempt>=dispatch.attempt)throw Error('Terminal attempt cannot be relaunched');
 const next={...checkpoint,activeDispatch:{...dispatch,status:'reserved' as const,handle:null}};
 validateAdoptionCheckpoint(next,next.consumerRoot,next.binding,next.inputFingerprint);return next;
}
export function adoptionResumeAction(checkpoint:AdoptionCheckpoint):'continue'|'follow'|'HITL'|'BLOCKED'|'complete'|'cancelled' {
 if(checkpoint.status==='cancelled')return 'cancelled';
 if(checkpoint.pendingHITL)return 'HITL';
 if(checkpoint.status==='blocked')return 'BLOCKED';
 if(checkpoint.status==='completed')return 'complete';
 if(checkpoint.activeDispatch)return checkpoint.activeDispatch.status==='running'&&checkpoint.activeDispatch.handle?'follow':'BLOCKED';
 return 'continue';
}
// The frontend presents these options and waits. References record user decisions;
// they never grant effects or authorize host operations by themselves.
export function requestAdoptionHITL(checkpoint:AdoptionCheckpoint,request:AdoptionHITL):AdoptionCheckpoint {
 if(checkpoint.status==='completed'||checkpoint.status==='cancelled'||checkpoint.pendingHITL)throw Error('Terminal installation or pending decision cannot be replaced');
 const next:AdoptionCheckpoint={...checkpoint,status:'waiting',pendingHITL:structuredClone(request)};
 validateAdoptionCheckpoint(next,next.consumerRoot,next.binding,next.inputFingerprint);return next;
}
export function resolveAdoptionHITL(checkpoint:AdoptionCheckpoint,optionId:string,decisionReference:string):AdoptionCheckpoint {
 validateAdoptionCheckpoint(checkpoint,checkpoint.consumerRoot,checkpoint.binding,checkpoint.inputFingerprint);
 if(!checkpoint.pendingHITL||!nonempty(decisionReference))throw Error('Pending request and explicit user decision required');
 const option=checkpoint.pendingHITL.options.find(o=>o.id===optionId);
 if(!option)throw Error('User must select a presented resolution option');
 if(option.action==='continue'&&checkpoint.activeDispatch)throw Error('Reconcile active dispatch before continuing; do not relaunch');
 if(option.action==='continue'&&checkpoint.defect?.correction==='reserved')throw Error('Reconcile reserved correction postconditions before continuing');
 const next:AdoptionCheckpoint={...checkpoint,status:option.action==='cancel'?'cancelled':'active',pendingHITL:null,
  resolution:{option:structuredClone(option),requestReference:checkpoint.pendingHITL.authorizationReference,decisionReference},
  defect:option.action==='continue'?null:checkpoint.defect};
 validateAdoptionCheckpoint(next,next.consumerRoot,next.binding,next.inputFingerprint);return next;
}
export function reserveAdoptionCorrection(checkpoint:AdoptionCheckpoint,defectId:string,evidence:AdoptionEvidence):AdoptionCheckpoint {
 if(checkpoint.status!=='active'||checkpoint.activeDispatch||checkpoint.pendingHITL)throw Error('Resolve active operation/HITL before correction');
 if(checkpoint.defect?.correction==='reserved'||(checkpoint.defect&&checkpoint.defect.afterFingerprint!==checkpoint.inputFingerprint))throw Error('Reconcile previous correction postconditions before another adaptation');
 if(checkpoint.defect&&same(checkpoint.defect.evidence,evidence))throw Error('Revised diagnosis/adaptation evidence required; unchanged retries prohibited');
 evidencePath(checkpoint.consumerRoot,evidence);
 return {...checkpoint,defect:{id:defectId,evidence,correction:'reserved',beforeFingerprint:checkpoint.inputFingerprint,afterFingerprint:null}};
}
export function recordAdoptionCheck(checkpoint:AdoptionCheckpoint,evidence:AdoptionEvidence):AdoptionCheckpoint {
 const dispatch=checkpoint.activeDispatch;
 if(!dispatch||dispatch.kind==='correction')throw Error('Check dispatch identity required');
 const report=JSON.parse(readFileSync(evidencePath(checkpoint.consumerRoot,evidence),'utf8'));
 if(report.identity?.executionId!==dispatch.executionId||report.identity?.attempt!==dispatch.attempt||report.identity?.bindingDigest!==sha256(JSON.stringify(checkpoint.binding))||!['PASS','FAIL','BLOCKED','INCONCLUSIVE'].includes(report.outcome))throw Error('Terminal check identity/outcome mismatch');
 if(report.purpose!==(dispatch.kind==='readiness'?'consumer-readiness':'platform-self-check'))throw Error('Wrong check evidence scope');
 if(dispatch.kind==='readiness'&&report.inputFingerprint!==checkpoint.inputFingerprint)throw Error('Readiness assessment inputs changed');
 return {...checkpoint,activeDispatch:null,lastCheck:{executionId:dispatch.executionId,attempt:dispatch.attempt,kind:dispatch.kind,outcome:report.outcome,evidence}};
}
function evidencePath(root:string,ref:AdoptionEvidence):string {
 if(!reference(ref))throw Error('Digest-bound evidence reference required');
 const path=confinedPath(root,ref.path);if(sha256(readFileSync(path))!==ref.sha256)throw Error('Adoption evidence changed');return path;
}
export interface AdoptionAssessment {
 inputFingerprint:string;bindingDigest:string;resolution:ResolutionConfig;
 frontendConfiguration:AdoptionEvidence;integration:AdoptionEvidence;selfCheck:AdoptionEvidence;readiness:AdoptionEvidence[];
 prerequisites:{sourceRef:string;reason:string;evidence:AdoptionEvidence[]}[];
 unresolved:string[];
}
export function validateAdoptionAssessment(checkpoint:AdoptionCheckpoint,assessment:AdoptionAssessment):void {
 if(checkpoint.hookDecision.state==='Unresolved'||checkpoint.hookDecision.inputFingerprint!==checkpoint.inputFingerprint||assessment.inputFingerprint!==checkpoint.inputFingerprint||assessment.bindingDigest!==sha256(JSON.stringify(checkpoint.binding))||!Array.isArray(assessment.unresolved)||assessment.unresolved.length||!assessment.readiness?.length||!assessment.prerequisites?.length)throw Error('Applicable readiness assessment is incomplete or stale');
 resolveResources(checkpoint.binding,{...assessment.resolution,mode:'execution'});
 for(const ref of [assessment.frontendConfiguration,assessment.integration])evidencePath(checkpoint.consumerRoot,ref);
 const self=JSON.parse(readFileSync(evidencePath(checkpoint.consumerRoot,assessment.selfCheck),'utf8'));
 if(self.purpose!=='platform-self-check'||self.outcome!=='PASS'||self.indexDigest!==checkpoint.binding.index.sha256||self.identity?.bindingDigest!==assessment.bindingDigest||!self.evidence?.length)throw Error('Installed platform self-check has not passed');
 const selfRecords=collectPreflight(requireReadinessRoot(checkpoint.consumerRoot,self.evidence[0]),self.identity);
 if(selfRecords.errors.length||selfRecords.records.length!==2||selfRecords.records[1].status!=='PASS')throw Error('Self-check evidence no longer valid');
 for(const ref of assessment.readiness){
  const report=JSON.parse(readFileSync(evidencePath(checkpoint.consumerRoot,ref),'utf8'));
  if(report.purpose!=='consumer-readiness'||report.outcome!=='PASS'||report.inputFingerprint!==checkpoint.inputFingerprint||report.identity?.bindingDigest!==assessment.bindingDigest||report.runner?.status!=='passed'||report.runner?.status!=='passed'||report.runner?.exitCode!==0||report.entry?.exitCode!==0||report.entry?.timedOut||!report.configurationFingerprint||!report.evidence?.length)throw Error('Current completed consumer readiness required');
  if(!report.sources?.length||report.sources.some((source:AdoptionEvidence)=>sha256(readFileSync(source.path))!==source.sha256))throw Error('Consumer integration changed since readiness');
  const root=requireReadinessRoot(checkpoint.consumerRoot,report.evidence[0]);
  const collected=collectPreflight(root,report.identity);
  if(collected.errors.length||collected.records.at(-1)?.status!=='ENVIRONMENT READY')throw Error('Readiness evidence no longer valid');
 }
 for(const prerequisite of assessment.prerequisites){if(!nonempty(prerequisite.sourceRef)||!nonempty(prerequisite.reason)||!prerequisite.evidence?.length)throw Error('Every applicable prerequisite needs source-backed evidence');for(const ref of prerequisite.evidence)evidencePath(checkpoint.consumerRoot,ref);}
}
function requireReadinessRoot(root:string,path:string):string {
 return dirname(confinedPath(root,path));
}
