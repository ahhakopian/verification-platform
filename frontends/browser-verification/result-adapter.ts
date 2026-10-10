import {reconcile,type Reconciliation} from '../../runtime/evidence/reconcile.js';
import type {ClaimRecord,PreflightRecord} from '../../src/contracts/index.js';
import {validatePreflightRecord,validatePreflightOrder,preflightBlockerClaims,readablePreflight} from '../../runtime/evidence/readiness.js';
export interface AgentClaimObservation {
 claimId:string;environmentId:string;attempted:boolean;
 conclusion:'established'|'contradicted'|'unresolved'|'unavailable';
 evidenceIds:string[];assertions:string[];reason:string;
 errors:ClaimRecord['errors'];proofRelevantCleanupFailed:boolean;facts:unknown;
}
export interface AgentReportInput extends Omit<Reconciliation,'records'> {
 assignedPairs:{claimId:string;environmentId:string}[];
 observations:AgentClaimObservation[];
 rejectedClaims:{claim:string;reason:string}[];
 attachmentState:unknown;
 preflightRecords?:PreflightRecord[];
}
export function reconcileAgentResult(input:AgentReportInput){
 const keys=new Set(input.assignedPairs.map(p=>JSON.stringify([p.claimId,p.environmentId])));
 const manifest=structuredClone(input.manifest);
 for(const entry of manifest.entries)if(!keys.has(JSON.stringify([entry.claimId,entry.environmentId])))entry.blocker='Outside current bounded agent assignment';
 const records:ClaimRecord[]=input.observations.map(observation=>{
  const entry=manifest.entries.find(e=>e.claimId===observation.claimId&&e.environmentId===observation.environmentId);
  if(!entry||!keys.has(JSON.stringify([observation.claimId,observation.environmentId]))||!entry.testKey)throw Error('Agent observation is outside current mapped assignment');
  return {schemaVersion:1,identity:input.identity,testKey:entry.testKey,claimId:observation.claimId,environmentId:observation.environmentId,attempted:observation.attempted,outcome:observation.conclusion==='established'?'proved':observation.conclusion==='contradicted'?'contradicted':observation.conclusion==='unavailable'&&!observation.attempted?'blocked':'unresolved',evidenceIds:observation.evidenceIds,assertions:observation.assertions,reason:observation.reason,errors:observation.errors,proofRelevantCleanupFailed:observation.proofRelevantCleanupFailed};
 });
 const preflight=input.preflightRecords??[];
 const errors=[...preflight.flatMap(r=>validatePreflightRecord(r,input.outputRoot,input.identity)),...validatePreflightOrder(preflight)];
 if(errors.length)throw Error('Invalid agent preflight evidence: '+errors.join('; '));
 records.push(...preflightBlockerClaims(preflight,manifest,input.identity,records));
 const result=reconcile({...input,manifest,records});
 const planWide=manifest.entries.every(e=>keys.has(JSON.stringify([e.claimId,e.environmentId])));
 return {result,scope:planWide?'plan':'bounded',observedFacts:input.observations.map(o=>({claimId:o.claimId,environmentId:o.environmentId,facts:o.facts})),rejectedClaims:input.rejectedClaims,attachmentState:input.attachmentState,
  preflightRecords:preflight,
  readable:[readablePreflight(preflight),result.claims.map(c=>`${c.claimId}/${c.environmentId}: ${c.verdict} — ${c.reason}`).join('\n')].filter(Boolean).join('\n')};
}
