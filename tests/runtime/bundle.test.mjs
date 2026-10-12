import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {currentResultFixture} from '../fixtures/current-result.mjs';
import {validateBundle,discoverProviders} from '../../dist/src/compilation/bundle.js';
import {sourceDigest} from '../../dist/src/validation/result.js';
import {sha256} from '../../dist/src/resources/resolve.js';
import {provider} from '../fixtures/execution.mjs';
import {validateSchema} from '../../dist/src/validation/schema.js';
import {reconcile} from '../../dist/runtime/evidence/reconcile.js';
import {validateResult} from '../../dist/src/validation/result.js';
function setup(){const f=currentResultFixture(),root=f.projectRoot,p=structuredClone(provider);
 p.entry='provider.mjs';p.declarations='provider.d.mts';p.capabilities[0].export='observeVersion';p.capabilities[0].support='established';p.capabilities[0].evidenceRefs=['synthetic-compiler-fixture-only'];
 writeFileSync(join(root,p.entry),`export const descriptor=${JSON.stringify(p)};export function observeVersion(){return 'synthetic-version';}`);
 writeFileSync(join(root,p.declarations),'export function observeVersion(): string;');
 const pw=pathToFileURL(resolve('node_modules/@playwright/test/index.mjs')).href;
 writeFileSync(join(root,'fixture.mjs'),`export {test,expect} from '${pw}';export {observeVersion} from './provider.mjs';`);
 writeFileSync(join(root,'fixture.d.mts'),"export {test,expect} from '@playwright/test';export {observeVersion} from './provider.mjs';");
 const plan=JSON.parse(f.planBytes);plan.configurationReferences[0].path='./fixture.mjs';f.planBytes=JSON.stringify(plan);f.assignment.planDigest=sha256(f.planBytes);f.assignment.authorization.planDigest=f.assignment.planDigest;f.manifest.identity.planDigest=f.assignment.planDigest;
 f.assignment.fixtureEntry='./fixture.mjs';f.assignment.providers[0].entry=p.entry;f.manifest.identity.fixtureDigest=sha256(readFileSync(join(root,'fixture.mjs')));f.manifest.identity.assignmentDigest=sha256(JSON.stringify(f.assignment));
 const source="import {test,expect,observeVersion} from './fixture.mjs';test('version',{annotation:{type:'testKey',description:'version-key'}},async()=>{await test.step('observe',async()=>{expect(observeVersion()).toBe('synthetic-version');});});\n";
 writeFileSync(join(root,'reference.spec.ts'),source);f.manifest.identity.generatedSourceDigest=sourceDigest(root,['reference.spec.ts']);
 const tsconfig=join(root,'tsconfig.json');writeFileSync(tsconfig,JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,skipLibCheck:true,baseUrl:root,paths:{'@playwright/test':[resolve('node_modules/@playwright/test')]}},include:['reference.spec.ts','*.d.mts']}));
 return {f,root,tsconfig,p};}
const available=(version='1',id='chrome:version',environmentId='assigned-chrome')=>({schemaVersion:1,capabilityId:id,capabilityVersion:version,environmentId,status:'available',reason:'Synthetic current provider prerequisites',evidenceRefs:['synthetic']});
function updatePlan(f,plan){f.planBytes=JSON.stringify(plan);f.assignment.planDigest=sha256(f.planBytes);f.assignment.authorization.planDigest=f.assignment.planDigest;f.manifest.identity.planDigest=f.assignment.planDigest;}
function updateProvider({root,p}){writeFileSync(join(root,p.entry),`export const descriptor=${JSON.stringify(p)};export function observeVersion(){return 'synthetic-version';}`);}
async function checkBundle(fixture,overrides={}){
 const {f,root,tsconfig}=fixture;
 const invocation={schemaVersion:1,planPath:'plan.json',planDigest:f.assignment.planDigest,binding:f.binding,assignment:f.assignment};
 writeFileSync(join(root,'plan.json'),f.planBytes);
 f.manifest.identity.assignmentDigest=sha256(JSON.stringify(f.assignment));
 f.manifest.identity.providerSources=(await discoverProviders(invocation,root)).sources;
 f.manifest.identity.generatedSourceDigest=sourceDigest(root,['reference.spec.ts']);
 return validateBundle({invocation,resolution:f.resolution,manifest:f.manifest,cwd:root,files:['reference.spec.ts'],tsconfig,typescriptEntry:resolve('node_modules/typescript/bin/tsc'),readiness:[available()],...overrides});
}
function proofResult(f){return reconcile({plan:JSON.parse(f.planBytes),assignment:f.assignment,manifest:f.manifest,identity:f.manifest.identity,records:f.records,evidence:f.evidence,outputRoot:f.outputRoot,runner:{exitCode:0,status:'passed'}});}

test('mechanical full reconciliation is separate from product contradiction and omitted semantic operations',async()=>{
 const fixture=setup();
 const checked=await checkBundle(fixture);
 assert.equal(checked.fullyReconciled,true,checked.diagnostics.join('\n'));
 fixture.f.records[0].outcome='contradicted';
 const result=proofResult(fixture.f);
 assert.equal(result.verdict,'FAIL');
 assert.deepEqual(validateResult({...fixture.f,result}),{valid:false,verdict:'FAIL',diagnostics:['Required proof is FAIL']});
 // Correct labels/types cannot prove that the required observation occurs.
 writeFileSync(join(fixture.root,'reference.spec.ts'),"import {test,expect} from './fixture.mjs';test('version',{annotation:{type:'testKey',description:'version-key'}},()=>{expect(true).toBe(true);});\n");
 const omitted=await checkBundle(fixture);
 assert.equal(omitted.fullyReconciled,true,omitted.diagnostics.join('\n'));
 assert.equal(omitted.valid,true);
});

test('valid partial coverage resumes after corrected code and mapping without changing mandatory obligations',async()=>{
 const fixture=setup(),{f,root}=fixture,plan=JSON.parse(f.planBytes);
 plan.claims.push({...structuredClone(plan.claims[0]),id:'second',proof:[{...plan.claims[0].proof[0],id:'second-proof'}]});
 updatePlan(f,plan);const original=f.planBytes;
 const blocked={...structuredClone(f.manifest.entries[0]),claimId:'second',proofIds:['second-proof'],assertions:[],steps:[],blocker:'Synthetic second proof prerequisite unavailable'};
 delete blocked.testKey;delete blocked.source;delete blocked.title;f.manifest.entries.push(blocked);
 const partial=await checkBundle(fixture);
 assert.equal(partial.valid,true,partial.diagnostics.join('\n'));assert.equal(partial.fullyReconciled,false);
 const partialProof=proofResult(f);
 assert.deepEqual(partialProof.claims.map(c=>c.verdict),['PASS','BLOCKED']);
 assert.equal(validateResult({...f,result:partialProof}).valid,false);
 f.manifest.entries[1]={...structuredClone(f.manifest.entries[0]),claimId:'second',proofIds:['second-proof'],steps:['observe','second-proof observation']};
 writeFileSync(join(root,'reference.spec.ts'),readFileSync(join(root,'reference.spec.ts'),'utf8').replace("expect(observeVersion()).toBe('synthetic-version');","expect(observeVersion()).toBe('synthetic-version');expect(observeVersion()).toBe('synthetic-version');"));
 f.manifest.identity.attempt++;
 const complete=await checkBundle(fixture);
 assert.equal(complete.valid,true,complete.diagnostics.join('\n'));assert.equal(complete.fullyReconciled,true);
 assert.equal(f.planBytes,original);assert.deepEqual(f.manifest.entries.map(e=>e.proofIds),[['version-observation'],['second-proof']]);
 // The new executable mapping does not manufacture second-proof evidence.
 assert.equal(proofResult(f).claims[1].verdict,'INCONCLUSIVE');
});

test('exact-version established support cannot be borrowed from another descriptor version',async()=>{
 const fixture=setup(),{f,p}=fixture,plan=JSON.parse(f.planBytes);
 plan.claims[0].proof[0].capabilityVersion='2';updatePlan(f,plan);f.manifest.entries[0].capabilityVersions['chrome:version']='2';
 p.capabilities.push({...structuredClone(p.capabilities[0]),contractVersion:'2',support:'unestablished'});updateProvider(fixture);
 const rejected=await checkBundle(fixture,{readiness:[available('2')]});
 assert.equal(rejected.valid,false);assert.equal(rejected.fullyReconciled,false);
 assert(rejected.diagnostics.some(d=>d.includes('chrome:version@2')&&d.includes('browser-version/assigned-chrome')));
 p.capabilities[1].support='established';updateProvider(fixture);
 const accepted=await checkBundle(fixture,{readiness:[available('2')]});
 assert.equal(accepted.fullyReconciled,true,accepted.diagnostics.join('\n'));
});

test('readiness must match capability ID, version and environment; legacy records remain readable',async()=>{
 const fixture=setup(),{f,p}=fixture,plan=JSON.parse(f.planBytes);
 plan.claims[0].proof[0].capabilityVersion='2';updatePlan(f,plan);f.manifest.entries[0].capabilityVersions['chrome:version']='2';p.capabilities[0].contractVersion='2';updateProvider(fixture);
 const legacy=available();delete legacy.capabilityVersion;assert.deepEqual(validateSchema('readiness',legacy),[]);
 for(const readiness of [available('1'),legacy,available('2','other:id'),available('2','chrome:version','other-environment'),{...available('2'),extra:true}]){
  const rejected=await checkBundle(fixture,{readiness:[readiness]});
  assert.equal(rejected.valid,false);assert.equal(rejected.fullyReconciled,false);
  assert(rejected.diagnostics.some(d=>d.includes('Unavailable capability readiness: chrome:version@2')));
 }
 const accepted=await checkBundle(fixture,{readiness:[available('2')]});
 assert.equal(accepted.fullyReconciled,true,accepted.diagnostics.join('\n'));
});

test('high-level unannotated proofs accept supported compiler-selected operations and block unsupported mappings',async()=>{
 const fixture=setup(),{f}=fixture,plan=JSON.parse(f.planBytes);
 delete plan.claims[0].proof[0].capabilityId;delete plan.claims[0].proof[0].capabilityVersion;updatePlan(f,plan);
 const original=f.planBytes;
 const supported=await checkBundle(fixture);assert.equal(supported.fullyReconciled,true,supported.diagnostics.join('\n'));assert.equal(f.planBytes,original);
 f.manifest.entries[0].capabilityIds.push('consumer:missing');f.manifest.entries[0].capabilityVersions['consumer:missing']='1';
 const unavailable=await checkBundle(fixture);assert.equal(unavailable.valid,false);assert.equal(unavailable.fullyReconciled,false);
 delete f.manifest.entries[0].capabilityVersions['consumer:missing'];
 const versionless=await checkBundle(fixture);assert.equal(versionless.fullyReconciled,false);assert(versionless.diagnostics.some(d=>d.includes('Capability contract version missing')));
});

test('all invalid bundle return paths explicitly reject full reconciliation',async()=>{
 const fixture=setup();
 const malformed=await checkBundle(fixture,{invocation:{schemaVersion:1}});assert.equal(malformed.fullyReconciled,false);
 const wrongDigest=await checkBundle(fixture,{invocation:{schemaVersion:1,planPath:'plan.json',planDigest:'0'.repeat(64),binding:fixture.f.binding,assignment:fixture.f.assignment}});assert.equal(wrongDigest.fullyReconciled,false);
 writeFileSync(join(fixture.root,'reference.spec.ts'),readFileSync(join(fixture.root,'reference.spec.ts'),'utf8').replace('observeVersion()', 'observeVersion(123)'));
 const mistyped=await checkBundle(fixture);assert.equal(mistyped.valid,false);assert.equal(mistyped.fullyReconciled,false);assert(mistyped.diagnostics.some(d=>d.includes('Typecheck blocked:')));
 fixture.f.manifest.entries=[];
 const missing=await checkBundle(fixture);assert.equal(missing.fullyReconciled,false);assert(missing.diagnostics.some(d=>d.includes('Invalid invocation/manifest format')));
});
test('successful concrete bundle typechecks configured real fixture/provider exports',async()=>{const {f,root,tsconfig}=setup();const invocation={schemaVersion:1,planPath:'plan.json',planDigest:f.assignment.planDigest,binding:f.binding,assignment:f.assignment};writeFileSync(join(root,'plan.json'),f.planBytes);f.manifest.identity.providerSources=(await discoverProviders(invocation,root)).sources;const result=await validateBundle({invocation,resolution:f.resolution,manifest:f.manifest,cwd:root,files:['reference.spec.ts'],tsconfig,typescriptEntry:resolve('node_modules/typescript/bin/tsc'),readiness:[{schemaVersion:1,capabilityId:'chrome:version',capabilityVersion:'1',environmentId:'assigned-chrome',status:'available',reason:'synthetic explicit compiler fixture',evidenceRefs:['synthetic']} ]});assert.equal(result.valid,true,result.diagnostics.join('\n'));});
test('ordinary runner import cannot bypass caller composed fixture import',async()=>{const {f,root,tsconfig}=setup();const invocation={schemaVersion:1,planPath:'plan.json',planDigest:f.assignment.planDigest,binding:f.binding,assignment:f.assignment};writeFileSync(join(root,'plan.json'),f.planBytes);f.manifest.identity.providerSources=(await discoverProviders(invocation,root)).sources;writeFileSync(join(root,'reference.spec.ts'),"import {test,expect} from '@playwright/test';test('version',()=>{expect(1).toBe(1)}); // testKey\n");f.manifest.identity.generatedSourceDigest=sourceDigest(root,['reference.spec.ts']);const result=await validateBundle({invocation,resolution:f.resolution,manifest:f.manifest,cwd:root,files:['reference.spec.ts'],tsconfig,typescriptEntry:'must-not-run',readiness:[]});assert.equal(result.valid,false);assert(result.diagnostics.some(d=>d.includes('configured fixture test and expect')));});
test('effect authorization for another claim cannot expand a runnable claim effects',async()=>{const {f,root,tsconfig,p}=setup();const plan=JSON.parse(f.planBytes);plan.claims.push({...structuredClone(plan.claims[0]),id:'other',allowedEffects:['other-effect'],proof:[{...plan.claims[0].proof[0],id:'other-proof'}]});f.planBytes=JSON.stringify(plan);f.assignment.planDigest=sha256(f.planBytes);f.assignment.authorization.planDigest=f.assignment.planDigest;f.assignment.authorization.allowedEffects=['other-effect'];f.manifest.identity.planDigest=f.assignment.planDigest;f.manifest.identity.assignmentDigest=sha256(JSON.stringify(f.assignment));f.manifest.entries.push({...structuredClone(f.manifest.entries[0]),claimId:'other',proofIds:['other-proof'],testKey:undefined,source:undefined,title:undefined,assertions:[],steps:[],blocker:'Independent assigned fixture dependency'});p.capabilities[0].effects=['other-effect'];writeFileSync(join(root,p.entry),`export const descriptor=${JSON.stringify(p)};export function observeVersion(){return 'synthetic-version';}`);writeFileSync(join(root,'plan.json'),f.planBytes);const invocation={schemaVersion:1,planPath:'plan.json',planDigest:f.assignment.planDigest,binding:f.binding,assignment:f.assignment};f.manifest.identity.providerSources=(await discoverProviders(invocation,root)).sources;const result=await validateBundle({invocation,resolution:f.resolution,manifest:f.manifest,cwd:root,files:['reference.spec.ts'],tsconfig,typescriptEntry:'must-not-run',readiness:[{schemaVersion:1,capabilityId:'chrome:version',capabilityVersion:'1',environmentId:'assigned-chrome',status:'available',reason:'synthetic',evidenceRefs:['fixture']} ]});assert.equal(result.valid,false);assert(result.diagnostics.some(d=>d.includes('Normative claim does not permit capability effects: browser-version')));});
