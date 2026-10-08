import type {Binding,Plan,Assignment,Manifest,Result,Evidence,ClaimRecord} from '../contracts/index.js';
import {validatePlan} from './plan.js';
import {validateSchema} from './schema.js';
import {reconcile} from '../../runtime/evidence/reconcile.js';
import type {ResolutionConfig} from '../resources/resolve.js';
import {sha256} from '../resources/resolve.js';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export const sourceDigest=(root:string,files:string[])=>sha256(JSON.stringify([...new Set(files)].sort().map(path=>({path,bytes:readFileSync(resolve(root,path),'utf8')}))));
export function validateResult(input:{planBytes:string;binding:Binding;resolution:ResolutionConfig;projectRoot:string;assignment:Assignment;manifest:Manifest;result:Result;evidence:Evidence[];records:ClaimRecord[];outputRoot:string;sourceRoot:string}){
 if(validateSchema('coverage-manifest',input.manifest).length||validateSchema('assignment',input.assignment).length||validateSchema('result',input.result).length)return {valid:false,verdict:'BLOCKED',diagnostics:['Invalid manifest/assignment/result contract format']};
 const validation=validatePlan({...input,resolution:{...input.resolution,mode:'execution'}});
 const diagnostics=validation.diagnostics.map(d=>d.path+': '+d.message);
 if(validateSchema('result',input.result).length)diagnostics.push('Invalid result envelope');
 const id=input.manifest.identity;
 if(id.planDigest!==validation.planDigest||id.bindingDigest!==validation.bindingDigest||id.assignmentDigest!==sha256(JSON.stringify(input.assignment)))diagnostics.push('Result current input identity mismatch');
 try {if(id.generatedSourceDigest!==sourceDigest(input.sourceRoot,input.manifest.entries.filter(e=>!e.blocker).map(e=>e.source!)))diagnostics.push('Generated source bytes mismatch');}catch(error){diagnostics.push('Generated source unavailable: '+String(error));}
 try {
  if(id.fixtureDigest!==sha256(readFileSync(resolve(input.projectRoot,input.assignment.fixtureEntry))))diagnostics.push('Fixture entry bytes mismatch');
  for(const provider of id.providerSources){if(sha256(readFileSync(resolve(input.projectRoot,provider.entry)))!==provider.entryDigest||sha256(readFileSync(resolve(input.projectRoot,provider.declarations)))!==provider.declarationsDigest)diagnostics.push('Provider implementation/declaration bytes mismatch: '+provider.id);}
 }catch(error){diagnostics.push('Fixture/provider source unavailable: '+String(error));}
 if(diagnostics.length)return {valid:false,verdict:'BLOCKED',diagnostics};
 try {
  const result=reconcile({plan:JSON.parse(input.planBytes),assignment:input.assignment,manifest:input.manifest,identity:id,evidence:input.evidence,records:input.records,outputRoot:input.outputRoot,runner:input.result.runner,limitations:input.result.limitations});
  if(JSON.stringify(result)!==JSON.stringify(input.result))return {valid:false,verdict:'INCONCLUSIVE',diagnostics:['Result differs from current mandatory evidence reconciliation']};
  return {valid:result.verdict==='PASS',verdict:result.verdict,diagnostics:result.verdict==='PASS'?[]:['Required proof is '+result.verdict]};
 }catch(error){return {valid:false,verdict:'BLOCKED',diagnostics:[String(error)]};}
}
