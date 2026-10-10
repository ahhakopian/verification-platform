import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {readFileSync,writeFileSync,readdirSync,realpathSync,mkdirSync} from 'node:fs';
import {sha256} from '../../src/resources/resolve.js';
import type {ExecutionIdentity,PreflightRecord,Manifest,ClaimRecord} from '../../src/contracts/index.js';
import {validateSchema} from '../../src/validation/schema.js';
export const readinessFailurePath=(root:string,executionId:string,workerIndex:number)=>join(root,`runtime-readiness-${sha256(executionId)}-${workerIndex}.json`);
export async function recordReadinessFailure(root:string,identity:ExecutionIdentity|undefined,workerIndex:number,capability:string,error:unknown){
 if(!identity)return;
 const detail=error instanceof Error?error.message:String(error);
 const structured=error as {raw?:unknown;cleanupErrors?:string[]};
 try{await mkdir(root,{recursive:true});await writeFile(readinessFailurePath(root,identity.executionId,workerIndex),JSON.stringify({schemaVersion:1,identity,workerIndex,capability,phase:'readiness',attempted:false,category:'prerequisite',detail,raw:structured?.raw,cleanupErrors:structured?.cleanupErrors??[]})+'\n');}
 catch(collectionError){process.stderr.write('Readiness evidence collection error: '+String(collectionError)+'\n');}
}

export function confinedPath(root:string,path:string):string {
 const base=realpathSync(root),full=realpathSync(resolve(root,path)),rel=relative(base,full);
 if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw Error('Evidence/entry path is outside assigned directory');
 return full;
}
export function validatePreflightRecord(record:PreflightRecord,root:string,identity:ExecutionIdentity){
 const errors=validateSchema('preflight',record).map(e=>e.message);
 if(errors.length)return errors;
 if(JSON.stringify(record.identity)!==JSON.stringify(identity))errors.push('Preflight current identity mismatch');
 for(const e of record.evidence??[])try{if(sha256(readFileSync(confinedPath(root,e.path)))!==e.sha256)errors.push('Preflight evidence digest mismatch');}catch(error){errors.push(String(error));}
 return errors;
}
export function validatePreflightOrder(records:PreflightRecord[]):string[] {
 const errors:string[]=[];
 for(const worker of new Set(records.map(r=>r.workerIndex))){
  const list=records.filter(r=>r.workerIndex===worker).sort((a,b)=>a.sequence-b.sequence);
  if(list.some((r,i)=>r.sequence!==i)||new Set(list.map(r=>r.environmentId)).size!==1){errors.push('Preflight sequence/environment mismatch');continue;}
  if(list[0]?.stage!=='browser'||(list.length>1&&list[1].stage!=='project')){errors.push('Preflight browser/project order mismatch');continue;}
  for(let i=2;i<list.length;i+=2){
   const target=list[i],gate=list[i+1];
   if(target.stage!=='target'||(gate&&(gate.stage!=='gate'||gate.testKey!==target.testKey)))errors.push('Preflight target/gate order mismatch');
   if(gate){const blocked=list[0].status==='BLOCKED'||list[1].status==='BLOCKED'||target.status==='BLOCKED';if(blocked&&gate.status!=='PREFLIGHT_BLOCKED')errors.push('Preflight blocked stage cannot yield READY');}
  }
 }
 return errors;
}
export class PreflightRecorder {
 readonly records:PreflightRecord[]=[];
 constructor(readonly root:string,readonly identity:ExecutionIdentity,readonly environmentId:string,readonly workerIndex:number){}
 async append(record:Omit<PreflightRecord,'schemaVersion'|'identity'|'environmentId'|'workerIndex'|'sequence'>){
  const value:PreflightRecord={...record,schemaVersion:1,identity:this.identity,environmentId:this.environmentId,workerIndex:this.workerIndex,sequence:this.records.length};
  await mkdir(this.root,{recursive:true});
  const errors=[...validatePreflightRecord(value,this.root,this.identity),...validatePreflightOrder([...this.records,value])];if(errors.length)throw Error(errors.join('; '));
  const path=join(this.root,`preflight-${sha256(this.identity.executionId)}-${this.workerIndex}-${value.sequence}.json`);
  await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const persisted=JSON.parse(readFileSync(path,'utf8'));if(validatePreflightRecord(persisted,this.root,this.identity).length)throw Error('Persisted preflight record invalid');
  this.records.push(persisted);return path;
 }
 async blocked(stage:'browser'|'project'|'target'|'gate',error:unknown,testKey?:string){
  const structured=error as {raw?:unknown;cleanupErrors?:string[]};
  const reason=error instanceof Error?error.message:String(error);
  const start=['browser','project','target','gate'].indexOf(stage);
  for(const next of (['browser','project','target','gate'] as const).slice(start))await this.append({stage:next,status:next==='gate'?'PREFLIGHT_BLOCKED':'BLOCKED',reason:next===stage?reason:'not attempted: prior preflight stage blocked',...(testKey?{testKey}:{}),observations:{detail:reason,...(structured?.raw?{raw:JSON.parse(JSON.stringify(structured.raw))}:{}),proof:'NOT RUN'},evidence:[],cleanupErrors:next===stage?structured?.cleanupErrors??[]:[]});
 }
}
export function collectPreflight(root:string,identity:ExecutionIdentity){
 const records:PreflightRecord[]=[],paths:string[]=[],errors:string[]=[];
 const collect=(dir:string)=>{for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory()){if(e.name!=='attachments')collect(path);}else if(e.name.startsWith(`preflight-${sha256(identity.executionId)}-`)&&e.name.endsWith('.json')){
  try{const value=JSON.parse(readFileSync(path,'utf8'));const invalid=validatePreflightRecord(value,root,identity);if(invalid.length)throw Error(invalid.join('; '));records.push(value);paths.push(path);}catch(error){errors.push('Rejected preflight record: '+String(error));}
 }}};
 try{collect(root);}catch(error){errors.push('Preflight collection error: '+String(error));}
 errors.push(...validatePreflightOrder(records));
 return {records:errors.length?[]:records,paths,errors};
}
export function preflightBlockerClaims(preflight:PreflightRecord[],manifest:Manifest,identity:ExecutionIdentity,existing:ClaimRecord[]=[]):ClaimRecord[]{
 if(validatePreflightOrder(preflight).length)return [];
 const gates=preflight.filter(r=>r.stage==='gate'&&r.status==='PREFLIGHT_BLOCKED'&&JSON.stringify(r.identity)===JSON.stringify(identity)&&
  (r.testKey||preflight.some(p=>p.workerIndex===r.workerIndex&&(p.stage==='browser'||p.stage==='project')&&p.status==='BLOCKED')));
 return manifest.entries.flatMap(entry=>{
  const gate=gates.find(g=>g.environmentId===entry.environmentId&&(!g.testKey||g.testKey===entry.testKey));
  if(!gate||!entry.testKey||existing.some(r=>r.claimId===entry.claimId&&r.environmentId===entry.environmentId))return [];
  const blocker=preflight.find(r=>r.workerIndex===gate.workerIndex&&r.sequence<=gate.sequence&&r.status==='BLOCKED'&&(!r.testKey||r.testKey===gate.testKey));
  return [{schemaVersion:1,testKey:entry.testKey,identity,claimId:entry.claimId,environmentId:entry.environmentId,attempted:false,outcome:'blocked',evidenceIds:[],assertions:[],reason:'PREFLIGHT_BLOCKED; proof: NOT RUN — '+(blocker?.reason??gate.reason),errors:[{category:'prerequisite',phase:'readiness',detail:blocker?.reason??gate.reason}],proofRelevantCleanupFailed:false} satisfies ClaimRecord];
 });
}
export function persistPreflightClaims(root:string,records:ClaimRecord[]){
 mkdirSync(root,{recursive:true});for(const record of records)writeFileSync(join(root,'claim-readiness-'+sha256(JSON.stringify(record))+'.json'),JSON.stringify(record,null,2)+'\n');
}
export function readablePreflight(records:PreflightRecord[]){return records.map(r=>r.stage==='gate'?r.status+(r.status==='PREFLIGHT_BLOCKED'?'\nproof: NOT RUN':''):`preflight.${r.stage} ${r.status} — ${r.reason}`).join('\n');}
