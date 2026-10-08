import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveResources,sha256} from '../../dist/src/resources/resolve.js';
import {validatePlan} from '../../dist/src/validation/plan.js';
const plan=JSON.parse(readFileSync(new URL('../fixtures/plan.json',import.meta.url)));
function fixture() {
 const root=mkdtempSync(join(tmpdir(),'verification-contract-'));
 const identity={repository:'https://github.com/test-fixture/verification-platform',tag:'v0.0.1',sourceCommit:'a'.repeat(40)};
 const contents={integration:'Integration fixture only',schema:readFileSync(new URL('../../schemas/browser-verification-plan.schema.json',import.meta.url),'utf8'),descriptors:JSON.stringify({schemaVersion:1,providers:[]})};
 const resources=Object.entries(contents).map(([id,bytes])=>({id,path:id+'.json',sha256:sha256(bytes),formatVersion:1,kind:'normative',dependencies:[]}));
 resources.forEach(r=>writeFileSync(join(root,r.path),contents[r.id]));
 const bytes=JSON.stringify({schemaVersion:1,...identity,resources});writeFileSync(join(root,'index.json'),bytes);
 const binding={schemaVersion:1,...identity,index:{asset:'index.json',sha256:sha256(bytes)},resources:{integration:'integration',planSchema:'schema',descriptors:'descriptors'}};
 return {root,binding,resolution:{root,indexPath:'index.json',mode:'planning'}};
}
test('normative-only snapshot validates representative planned config without runtime',()=>{const f=fixture();assert.equal(validatePlan({planBytes:JSON.stringify(plan),...f}).valid,true);assert.equal(resolveResources(f.binding,f.resolution).resources.size,3);});
test('precise duplicate, dangling and prerequisite cycle diagnostics',()=>{const f=fixture(),p=structuredClone(plan);p.claims.push(structuredClone(p.claims[0]));p.claims[0].sourceRefs=['missing'];p.prerequisites[0].dependsOn=['assignment'];const r=validatePlan({planBytes:JSON.stringify(p),...f});assert.equal(r.valid,false);assert(r.diagnostics.some(d=>d.code==='duplicate'));assert(r.diagnostics.some(d=>d.referenceId==='missing'));assert(r.diagnostics.some(d=>d.code==='cycle'));});
test('normative input rejects outcome/approval/live endpoint and unsupported version',()=>{for(const [key,value] of [['approved',true],['verdict','PASS'],['endpoint','ws://current'],['schemaVersion',2]]){const f=fixture();assert.equal(validatePlan({planBytes:JSON.stringify({...plan,[key]:value}),...f}).valid,false);}});
test('resource/index mutation, missing and mixed release block resolution',()=>{const f=fixture();writeFileSync(join(f.root,'schema.json'),'changed');assert.throws(()=>resolveResources(f.binding,f.resolution),/digest mismatch/);const g=fixture();assert.throws(()=>resolveResources({...g.binding,tag:'v0.0.2'},g.resolution),/Mixed platform/);assert.throws(()=>resolveResources({...g.binding,index:{...g.binding.index,sha256:'0'.repeat(64)}},g.resolution),/index digest/);});
test('execution rejects normative-only snapshot and planning configs',()=>{const f=fixture();assert.throws(()=>resolveResources(f.binding,{...f.resolution,mode:'execution'}),/Incomplete execution/);});
test('public CLI calls same validator without process context',()=>{const f=fixture();const input={planBytes:JSON.stringify(plan),...f};const p=spawnSync(process.execPath,['dist/src/validation/cli.js'],{input:JSON.stringify(input),encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stderr||String(p.error));assert.deepEqual(JSON.parse(p.stdout),validatePlan(input));});
