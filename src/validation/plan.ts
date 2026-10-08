import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plan, Assignment } from '../contracts/index.js';
import { sha256, resolveResources, type ResolutionConfig } from '../resources/resolve.js';
import type { Binding } from '../contracts/index.js';
import { validateSchema, validateDocument, type Diagnostic } from './schema.js';
export interface ValidationInput { planBytes: string; binding: Binding; resolution: ResolutionConfig; projectRoot?: string; assignment?: Assignment }
export function validatePlan(input: ValidationInput) {
  const diagnostics: Diagnostic[]=[];
  const add=(path:string,code:string,message:string,referenceId?:string)=>diagnostics.push({path,code,message,...(referenceId?{referenceId}:{})});
  const identity={planDigest:sha256(input.planBytes),bindingDigest:sha256(JSON.stringify(input.binding))};
  let plan: Plan;
  try {plan=JSON.parse(input.planBytes);} catch {return {...identity,valid:false,diagnostics:[{path:'/',code:'json',message:'Invalid plan JSON'}]};}
  diagnostics.push(...validateSchema('browser-verification-plan',plan));
  let resources;
  try { resources=resolveResources(input.binding,input.resolution); } catch(error) {add('/binding','resolution',String(error));}
  if(diagnostics.length) return {...identity,valid:false,diagnostics};
  try {diagnostics.push(...validateDocument(JSON.parse(readFileSync(resources!.resources.get(input.binding.resources.planSchema)!.path,'utf8')),plan));}
  catch(error){add('/binding/resources/planSchema','schema',String(error));}
  if(diagnostics.length) return {...identity,valid:false,diagnostics};
  const unique=(items:{id:string}[],path:string)=> {
    const set=new Set<string>(); items.forEach((x,i)=>{if(set.has(x.id)) add(`${path}/${i}/id`,'duplicate','Duplicate ID',x.id);set.add(x.id);});return set;
  };
  const sources=unique(plan.sourceReferences,'/sourceReferences'); const environments=unique(plan.environments,'/environments');
  const prerequisites=unique(plan.prerequisites,'/prerequisites'); const configs=unique(plan.configurationReferences,'/configurationReferences'); unique(plan.claims,'/claims');
  const refs=(ids:string[],known:Set<string>,path:string)=>ids.forEach((id,i)=>{if(!known.has(id)) add(`${path}/${i}`,'reference','Dangling reference',id);});
  const proofIds=new Set<string>();
  plan.claims.forEach((claim,i)=>{
    refs(claim.sourceRefs,sources,`/claims/${i}/sourceRefs`);refs(claim.environmentIds,environments,`/claims/${i}/environmentIds`);refs(claim.prerequisiteIds,prerequisites,`/claims/${i}/prerequisiteIds`);refs(claim.support.configurationRefs,configs,`/claims/${i}/support/configurationRefs`);
    if(!claim.proof.some(p=>p.mandatory)) add(`/claims/${i}/proof`,'mandatory','At least one mandatory proof is required',claim.id);
    claim.proof.forEach((p,j)=>{if(proofIds.has(p.id)) add(`/claims/${i}/proof/${j}/id`,'duplicate','Duplicate proof ID',p.id);proofIds.add(p.id);if(!sources.has(p.source)) add(`/claims/${i}/proof/${j}/source`,'reference','Dangling proof source',p.source);if(Boolean(p.capabilityId)!==Boolean(p.capabilityVersion)) add(`/claims/${i}/proof/${j}`,'capability','Capability ID and contract version must occur together');});
  });
  const graph=new Map(plan.prerequisites.map(p=>[p.id,p.dependsOn]));
  const active=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{if(active.has(id)){add('/prerequisites','cycle','Contradictory prerequisite cycle',id);return;}if(done.has(id))return;active.add(id);for(const dep of graph.get(id)??[])visit(dep);active.delete(id);done.add(id);};
  plan.prerequisites.forEach((p,i)=>{refs(p.dependsOn,prerequisites,`/prerequisites/${i}/dependsOn`);visit(p.id);});
  if(input.resolution.mode==='execution') {
    for(const [i,c] of plan.configurationReferences.entries()) if(!input.projectRoot||!existsSync(resolve(input.projectRoot,c.path))) add(`/configurationReferences/${i}`,'configuration','Execution requires an actual existing referenced configuration',c.id);
    if(!input.assignment) add('/assignment','assignment','Execution requires an explicit assignment');
    else {
      const a=input.assignment;const assignmentErrors=validateSchema('assignment',a);diagnostics.push(...assignmentErrors);
      if(assignmentErrors.length) return {...identity,indexDigest:resources?.indexDigest,valid:false,diagnostics};
      if(a.planDigest!==identity.planDigest||a.authorization.planDigest!==identity.planDigest||a.bindingDigest!==identity.bindingDigest||a.authorization.bindingDigest!==identity.bindingDigest) add('/assignment','identity','Assignment/authorization identity mismatch');
      refs(plan.environments.map(e=>e.id),new Set(a.environments.map(e=>e.id)),'/assignment/environments');
      const normativeEffects=new Set(plan.claims.flatMap(c=>c.allowedEffects));
      if(a.authorization.allowedEffects.some(e=>!normativeEffects.has(e))) add('/assignment/authorization/allowedEffects','effects','Authorization expands normative effects');
    }
  }
  return {...identity,indexDigest:resources?.indexDigest,valid:diagnostics.length===0,diagnostics};
}
