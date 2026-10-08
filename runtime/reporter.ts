import type {Reporter,TestCase,TestResult,FullResult} from '@playwright/test/reporter';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import type {ClaimRecord,Evidence} from '../src/contracts/index.js';
import {reconcile,type Reconciliation} from './evidence/reconcile.js';
import {sha256} from '../src/resources/resolve.js';
import {readinessFailurePath} from './evidence/readiness.js';
export interface ReporterOptions extends Omit<Reconciliation,'records'|'evidence'|'runner'> {resultPath:string;sourceRoot?:string}
export default class VerificationReporter implements Reporter {
 private records:ClaimRecord[]=[];private evidence:Evidence[]=[];private limitations:string[]=[];
 constructor(private options:ReporterOptions){}
 private persistReadinessClaim(record:ClaimRecord){
  try{mkdirSync(this.options.outputRoot,{recursive:true});writeFileSync(resolve(this.options.outputRoot,'claim-readiness-'+sha256(JSON.stringify(record))+'.json'),JSON.stringify(record,null,2)+'\n');}catch(error){this.limitations.push('Readiness claim collection error: '+String(error));}
  this.records.push(record);
 }
 onTestEnd(test:TestCase,result:TestResult){
  const keys=test.annotations.filter(a=>a.type==='testKey').map(a=>a.description);
  if(keys.length!==1||!this.options.manifest.entries.some(e=>e.testKey===keys[0]&&e.title===test.title&&resolve(this.options.sourceRoot??process.cwd(),e.source??'')===resolve(test.location.file))){this.limitations.push('Missing/ambiguous/unmapped testKey annotation: '+test.title);return;}
  for(const a of result.attachments)if(a.contentType==='application/json'&&(a.path||a.body)){try{const value=JSON.parse(a.path?readFileSync(a.path,'utf8'):a.body!.toString('utf8'));if(value.testKey!==keys[0])throw Error('Attachment testKey mismatch');if(a.name.startsWith('claim-'))this.records.push(value);if(a.name.startsWith('evidence-'))this.evidence.push(value);if(a.name==='readiness-selection'&&value.schemaVersion===1&&value.phase==='readiness'&&value.attempted===false&&value.category==='prerequisite'&&JSON.stringify(value.identity)===JSON.stringify(this.options.identity))for(const entry of this.options.manifest.entries.filter(e=>e.testKey===keys[0]))this.persistReadinessClaim({schemaVersion:1,testKey:entry.testKey!,identity:this.options.identity,claimId:entry.claimId,environmentId:entry.environmentId,attempted:false,outcome:'blocked',evidenceIds:[],assertions:[],reason:value.detail,errors:[{category:'prerequisite',phase:'readiness',detail:value.detail}],proofRelevantCleanupFailed:false});}catch(error){this.limitations.push('Attachment collection error: '+String(error));}}
  try{
   const failure=JSON.parse(readFileSync(readinessFailurePath(this.options.outputRoot,this.options.identity.executionId,result.workerIndex),'utf8'));
   if(failure.schemaVersion===1&&failure.workerIndex===result.workerIndex&&failure.phase==='readiness'&&failure.attempted===false&&failure.category==='prerequisite'&&JSON.stringify(failure.identity)===JSON.stringify(this.options.identity)){
    for(const entry of this.options.manifest.entries.filter(e=>e.testKey===keys[0]))if(!this.records.some(r=>r.claimId===entry.claimId&&r.environmentId===entry.environmentId&&r.attempted))this.persistReadinessClaim({schemaVersion:1,testKey:entry.testKey!,identity:this.options.identity,claimId:entry.claimId,environmentId:entry.environmentId,attempted:false,outcome:'blocked',evidenceIds:[],assertions:[],reason:failure.detail,errors:[{category:'prerequisite',phase:'readiness',detail:failure.detail}],proofRelevantCleanupFailed:false});
    this.limitations.push(...failure.cleanupErrors);
   }
  }catch{}
  for(const error of result.errors)this.limitations.push(error.message??String(error));
 }
 onEnd(result:FullResult){const report=reconcile({...this.options,records:this.records,evidence:this.evidence,runner:{exitCode:result.status==='passed'?0:null,status:result.status},limitations:[...(this.options.limitations??[]),...this.limitations]});writeFileSync(this.options.resultPath,JSON.stringify(report,null,2)+'\n');}
}
