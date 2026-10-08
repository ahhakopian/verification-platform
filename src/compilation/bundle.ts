import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import type {Invocation,Manifest,Provider,Readiness,ProviderSourceIdentity} from '../contracts/index.js';
import {validateCoverage} from './coverage.js';
import {validatePlan} from '../validation/plan.js';
import {sha256,type ResolutionConfig} from '../resources/resolve.js';
import {validateSchema} from '../validation/schema.js';
import {boundedProcess} from '../../runtime/host/wsl-windows/process.js';
import {sourceDigest} from '../validation/result.js';
export async function discoverProviders(invocation:Invocation,cwd:string):Promise<{providers:Provider[];sources:ProviderSourceIdentity[];diagnostics:string[]}> {
 const providers:Provider[]=[],sources:ProviderSourceIdentity[]=[],diagnostics:string[]=[];
 for(const configured of invocation.assignment.providers) {
  try {const entryPath=resolve(cwd,configured.entry);const entryDigest=sha256(readFileSync(entryPath));const entryUrl=pathToFileURL(entryPath);entryUrl.searchParams.set('verificationDigest',entryDigest);const module=await import(entryUrl.href);
   const candidates:Provider[]=module.descriptor?[module.descriptor]:Array.isArray(module.descriptors)?module.descriptors:[];
   const selected=candidates.filter(p=>p.id===configured.id);if(selected.length!==1)throw Error('Configured descriptor must match exactly once');const descriptor=selected[0];
   if(validateSchema('provider-descriptor',descriptor).length||descriptor.id!==configured.id||descriptor.version!==configured.version)throw Error('Descriptor identity/format mismatch');
   if(!readFileSync(resolve(cwd,descriptor.declarations),'utf8'))throw Error('Missing declarations');
   for(const c of descriptor.capabilities)if(c.support==='established'){
     const callable=c.export.split('.').reduce((value:any,name)=>value?.[name],module);
     // Fixture members are validated by the caller fixture's declarations and
     // generated source typecheck, rather than fabricated module properties.
     const fixtureMember=c.export.startsWith('fixture:')&&typeof module.test?.extend==='function'&&readFileSync(resolve(cwd,descriptor.declarations),'utf8').includes(c.export.slice(8));
     if((typeof callable!=='function'&&!fixtureMember)||!c.evidenceRefs.length)throw Error('Established callable/evidence not exported: '+c.id);
   }
   providers.push(descriptor);
   if(sha256(readFileSync(entryPath))!==entryDigest)throw Error('Provider entry changed during discovery');
   sources.push({id:descriptor.id,version:descriptor.version,entry:configured.entry,entryDigest,declarations:descriptor.declarations,declarationsDigest:sha256(readFileSync(resolve(cwd,descriptor.declarations)))});
  }catch(error){diagnostics.push(configured.id+': '+String(error));}
 }
 return {providers,sources,diagnostics};
}
export async function validateBundle(input:{invocation:Invocation;resolution:ResolutionConfig;manifest:Manifest;cwd:string;files:string[];tsconfig:string;typescriptEntry:string;readiness:Readiness[]}) {
 const {invocation,manifest}=input;const diagnostics:string[]=[];
 if(validateSchema('invocation',invocation).length||validateSchema('coverage-manifest',manifest).length)return {valid:false,diagnostics:['Invalid invocation/manifest format']};
 const bytes=readFileSync(resolve(input.cwd,invocation.planPath),'utf8');
 const validation=validatePlan({planBytes:bytes,binding:invocation.binding,resolution:{...input.resolution,mode:'execution'},projectRoot:input.cwd,assignment:invocation.assignment});
 if(!validation.valid)diagnostics.push(...validation.diagnostics.map(d=>d.path+': '+d.message));
 if(validation.planDigest!==invocation.planDigest)diagnostics.push('Invocation plan digest mismatch');
 if(diagnostics.length)return {valid:false,diagnostics,validation};
 const plan=JSON.parse(bytes);diagnostics.push(...validateCoverage(plan,invocation.assignment,manifest));
 if(manifest.identity.assignmentDigest!==sha256(JSON.stringify(invocation.assignment)))diagnostics.push('Assignment digest mismatch');
 const source=input.files.map(path=>({path,bytes:readFileSync(resolve(input.cwd,path),'utf8')}));
 if(manifest.identity.generatedSourceDigest!==sourceDigest(input.cwd,input.files))diagnostics.push('Generated source digest mismatch');
 const discovered=await discoverProviders(invocation,input.cwd);diagnostics.push(...discovered.diagnostics);
 if(JSON.stringify(discovered.sources)!==JSON.stringify(manifest.identity.providerSources))diagnostics.push('Provider source/declaration identity mismatch');
 try{if(manifest.identity.fixtureDigest!==sha256(readFileSync(resolve(input.cwd,invocation.assignment.fixtureEntry))))diagnostics.push('Fixture entry identity mismatch');}catch(error){diagnostics.push('Configured fixture entry unavailable');}
 const available=new Set(discovered.providers.flatMap(p=>p.capabilities.filter(c=>c.support==='established').map(c=>c.id)));
 for(const entry of manifest.entries)if(!entry.blocker){
  if(!input.files.includes(entry.source!))diagnostics.push('Mapped source not in bundle: '+entry.source);
  for(const id of entry.capabilityIds)if(!available.has(id)||!input.readiness.some(r=>r.capabilityId===id&&r.environmentId===entry.environmentId&&r.status==='available'&&r.evidenceRefs.length))diagnostics.push('Unavailable capability: '+id);
  for(const id of entry.capabilityIds)if(!discovered.providers.some(p=>p.capabilities.some(c=>c.id===id&&c.contractVersion===entry.capabilityVersions[id])))diagnostics.push('Capability contract mismatch: '+id);
  for(const provider of discovered.providers)for(const capability of provider.capabilities.filter(c=>entry.capabilityIds.includes(c.id)))if(capability.effects.some(effect=>!invocation.assignment.authorization.allowedEffects.includes(effect)))diagnostics.push('Assigned authorization does not permit capability effects: '+capability.id);
  const claim=plan.claims.find((c:any)=>c.id===entry.claimId);
  for(const provider of discovered.providers)for(const capability of provider.capabilities.filter(c=>entry.capabilityIds.includes(c.id)))if(capability.effects.some(effect=>!claim.allowedEffects.includes(effect)))diagnostics.push('Normative claim does not permit capability effects: '+entry.claimId+'/'+capability.id);
 }
 for(const s of source){
  const ast=ts.createSourceFile(s.path,s.bytes,ts.ScriptTarget.Latest,true);
  const imports=ast.statements.filter(ts.isImportDeclaration).map(n=>(n.moduleSpecifier as ts.StringLiteral).text);
  const permitted=new Set([invocation.assignment.fixtureEntry,'@playwright/test']);
  if(imports.some(i=>!permitted.has(i)))diagnostics.push('Unconfigured generated import: '+s.path);
  const fixtureImport=ast.statements.filter(ts.isImportDeclaration).find(n=>(n.moduleSpecifier as ts.StringLiteral).text===invocation.assignment.fixtureEntry);
  const named=fixtureImport?.importClause?.namedBindings;
  const symbols=named&&ts.isNamedImports(named)?named.elements.map(e=>(e.propertyName??e.name).text):[];
  if(!symbols.includes('test')||!symbols.includes('expect'))diagnostics.push('Generated source must import configured fixture test and expect: '+s.path);
  if(!s.bytes.includes('testKey'))diagnostics.push('Missing testKey annotation: '+s.path);
 }
 if(!diagnostics.length&&input.files.length){try{const typecheck=await boundedProcess(process.execPath,[input.typescriptEntry,'--project',input.tsconfig,'--noEmit'],30000);if(typecheck.exitCode!==0||typecheck.timedOut)diagnostics.push('Typecheck blocked: '+typecheck.stdout+typecheck.stderr);}catch(error){diagnostics.push('Typecheck invocation blocked: '+String(error));}}
 return {valid:!diagnostics.length,diagnostics,validation};
}
