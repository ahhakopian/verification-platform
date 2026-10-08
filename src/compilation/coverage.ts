import type {Plan,Assignment,Manifest} from '../contracts/index.js';
import {validateSchema} from '../validation/schema.js';
import {sha256} from '../resources/resolve.js';
export function validateCoverage(plan:Plan,assignment:Assignment,manifest:Manifest):string[]{
 const errors:string[]=[];
 if(validateSchema('browser-verification-plan',plan).length||validateSchema('assignment',assignment).length||validateSchema('coverage-manifest',manifest).length)return ['Invalid contract format'];
 const required=new Map(plan.claims.flatMap(c=>c.environmentIds.map(e=>[JSON.stringify([c.id,e]),{claim:c,env:e}] as const)));
 const mapped=new Set<string>();const testKeys=new Map<string,string>();
 for(const entry of manifest.entries){const key=JSON.stringify([entry.claimId,entry.environmentId]);const expected=required.get(key);if(!expected||mapped.has(key)){errors.push('Unknown/duplicate coverage pair '+key);continue;}mapped.add(key);
  const proofIds=expected.claim.proof.filter(p=>p.mandatory).map(p=>p.id);
  const capabilities=expected.claim.proof.filter(p=>p.mandatory&&p.capabilityId).map(p=>({id:p.capabilityId!,version:p.capabilityVersion!}));
  if(JSON.stringify([...entry.capabilityIds].sort())!==JSON.stringify([...new Set(capabilities.map(c=>c.id))].sort()))errors.push('Mandatory capability mapping differs '+key);
  for(const capability of capabilities)if(entry.capabilityVersions[capability.id]!==capability.version)errors.push('Capability contract version differs '+key);
  if(JSON.stringify([...entry.proofIds].sort())!==JSON.stringify(proofIds.sort()))errors.push('Mandatory proof mapping differs '+key);
  if(JSON.stringify([...entry.sourceRefs].sort())!==JSON.stringify([...expected.claim.sourceRefs].sort())||entry.mode!==expected.claim.mode)errors.push('Normative source/mode mapping differs '+key);
  if(!entry.blocker&&(!entry.testKey||!entry.source||!entry.title||!entry.assertions.length))errors.push('Runnable mapping incomplete '+key);
  if(entry.testKey){const source=testKeys.get(entry.testKey);if(source&&source!==entry.source)errors.push('Ambiguous test key '+entry.testKey);testKeys.set(entry.testKey,entry.source??'');}
 }
 for(const key of required.keys())if(!mapped.has(key))errors.push('Missing required pair '+key);
 if(manifest.identity.planDigest!==assignment.planDigest||manifest.identity.bindingDigest!==assignment.bindingDigest)errors.push('Manifest assignment identity mismatch');
 if(manifest.identity.assignmentDigest!==sha256(JSON.stringify(assignment)))errors.push('Manifest assignment digest mismatch');
 const providers=assignment.providers.map(({id,version})=>({id,version}));
 if(JSON.stringify(providers)!==JSON.stringify(manifest.identity.providers))errors.push('Provider composition mismatch');
 const sources=manifest.identity.providerSources;
 if(sources.length!==assignment.providers.length||assignment.providers.some(p=>sources.filter(s=>s.id===p.id&&s.version===p.version&&s.entry===p.entry).length!==1))errors.push('Provider source composition mismatch');
 return errors;
}
