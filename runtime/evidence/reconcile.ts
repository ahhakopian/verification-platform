import {readFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import type {Manifest,Evidence,ClaimRecord,ExecutionIdentity,Result,Verdict,Plan,Assignment} from '../../src/contracts/index.js';
import {validateCoverage} from '../../src/compilation/coverage.js';
import {sha256} from '../../src/resources/resolve.js';
import {validateSchema} from '../../src/validation/schema.js';
export interface Reconciliation { plan:Plan;assignment:Assignment;manifest: Manifest; identity: ExecutionIdentity; evidence: Evidence[]; records: ClaimRecord[]; outputRoot: string; runner: Result['runner']; limitations?: string[] }
export function reconcile(input: Reconciliation): Result {
 const {manifest,identity}=input;
 const limitations=[...(input.limitations??[])];
 const sameIdentity=(value:ExecutionIdentity)=>JSON.stringify(value)===JSON.stringify(identity);
 if(validateSchema('coverage-manifest',manifest).length||!sameIdentity(manifest.identity)) throw new Error('Invalid/current identity-mismatched coverage manifest');
 const coverage=validateCoverage(input.plan,input.assignment,manifest);if(coverage.length)throw Error('Incomplete/current coverage: '+coverage.join('; '));
 const keys=new Set<string>();for(const e of manifest.entries){const k=JSON.stringify([e.claimId,e.environmentId]);if(keys.has(k))throw new Error('Duplicate coverage pair');keys.add(k);}
 const duplicateEvidence=new Set<string>();const seen=new Set<string>();for(const e of input.evidence){if(seen.has(e.evidenceId))duplicateEvidence.add(e.evidenceId);seen.add(e.evidenceId);}
 const validEvidence=new Map<string,Evidence>();
 for(const e of input.evidence) {
   if(validateSchema('evidence',e).length||e.executionId!==identity.executionId||duplicateEvidence.has(e.evidenceId)){limitations.push('Rejected evidence identity/format: '+e.evidenceId);continue;}
   const provider=identity.providers.find(p=>p.id===e.provider.id&&p.version===e.provider.version);
   if(!provider||!e.window.complete||e.window.loss.length){limitations.push('Rejected evidence provider/coverage: '+e.evidenceId);continue;}
   try {const path=resolve(input.outputRoot,e.attachment.path),rel=relative(resolve(input.outputRoot),path);if(rel.startsWith('..')||isAbsolute(rel)||sha256(readFileSync(path))!==e.attachment.sha256)throw Error('Attachment digest/path');validEvidence.set(e.evidenceId,e);}
   catch(error){limitations.push('Missing/invalid attachment: '+e.evidenceId);}
 }
 const claims=manifest.entries.map(entry=>{
   const normative=input.plan.claims.find(c=>c.id===entry.claimId)!;
   const candidate=input.records.filter(r=>r.claimId===entry.claimId&&r.environmentId===entry.environmentId);
   const records=candidate.filter(r=>!validateSchema('claim-record',r).length&&sameIdentity(r.identity)&&r.testKey===entry.testKey);
   if(candidate.length!==records.length)limitations.push(`Rejected stale/invalid claim record: ${entry.claimId}/${entry.environmentId}`);
   const decisive=(r:ClaimRecord)=>r.attempted&&r.assertions.length>0&&entry.assertions.every(a=>r.assertions.includes(a))&&entry.proofIds.every(p=>r.evidenceIds.some(id=>{const e=validEvidence.get(id);const proof=normative.proof.find(x=>x.id===p)!;return Boolean(e&&e.testKey===entry.testKey&&e.claimId===entry.claimId&&e.environmentId===entry.environmentId&&e.proofIds.includes(p)&&proof.acceptedSources.some(s=>s.source===e.source&&s.providerId===e.provider.id));}));
   const fail=records.find(r=>r.outcome==='contradicted'&&decisive(r));
   const pass=records.find(r=>r.outcome==='proved'&&decisive(r)&&!r.proofRelevantCleanupFailed&&r.errors.every(e=>e.phase==='cleanup'));
   let verdict:Verdict='INCONCLUSIVE',reason='Missing adequate current proof or attempt record';let evidenceIds:string[]=[];
   if(fail){verdict='FAIL';reason=fail.reason;evidenceIds=fail.evidenceIds;}
   else if(records.some(r=>r.attempted)) {if(pass&&!records.some(r=>r.proofRelevantCleanupFailed)){verdict='PASS';reason=pass.reason;evidenceIds=pass.evidenceIds;}else reason=records.find(r=>r.attempted)?.reason??reason;}
   else if(entry.blocker||records.some(r=>r.outcome==='blocked'&&!r.attempted)){verdict='BLOCKED';reason=entry.blocker??records.find(r=>r.outcome==='blocked')!.reason;}
   // An unexplained runner crash/error cannot leave otherwise-successful claims accepted.
   if(verdict==='PASS'&&input.runner.status!=='passed'){verdict='INCONCLUSIVE';reason='Runner/collection did not complete successfully';}
   return {claimId:entry.claimId,environmentId:entry.environmentId,verdict,reason,evidenceIds};
 });
 const counts:Result['counts']={PASS:0,FAIL:0,BLOCKED:0,INCONCLUSIVE:0};for(const c of claims)counts[c.verdict]++;
 const verdict:Verdict=(['FAIL','BLOCKED','INCONCLUSIVE','PASS'] as const).find(v=>counts[v]>0)??'INCONCLUSIVE';
 return {schemaVersion:1,identity,verdict,claims,counts,runner:input.runner,limitations};
}
