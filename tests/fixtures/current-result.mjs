import {requiredExecutionResources,publicEntries} from '../../dist/src/resources/inventory.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';import {join,dirname} from 'node:path';import {tmpdir} from 'node:os';
import {validateResult,sourceDigest} from '../../dist/src/validation/result.js';
import {reconcile} from '../../dist/runtime/evidence/reconcile.js';
import {sha256} from '../../dist/src/resources/resolve.js';
import {plan,assignment,identity,manifest,evidence,record} from './execution.mjs';
export function currentResultFixture(){
 const root=mkdtempSync(join(tmpdir(),'verification-current-result-'));
 const release={repository:'https://github.com/test-fixture/verification-platform',tag:'v0.0.1',sourceCommit:'a'.repeat(40)};
 const contents={integration:'synthetic fixture',schema:readFileSync('schemas/browser-verification-plan.schema.json','utf8'),descriptors:'{"schemaVersion":1,"providers":[]}',runtime:'fixture',frontend:'fixture'};
 const resources=Object.entries(contents).map(([id,bytes])=>({id,path:id,sha256:sha256(bytes),formatVersion:1,kind:id==='runtime'?'runtime':id==='frontend'?'frontend':'normative',dependencies:[]}));
 for(const r of resources)writeFileSync(join(root,r.path),contents[r.id]);
 for(const expected of requiredExecutionResources){const path=join(root,expected.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'synthetic indexed fixture');resources.push({...expected,sha256:sha256('synthetic indexed fixture'),formatVersion:1,dependencies:[],...(publicEntries[expected.id]?{entry:publicEntries[expected.id]}:{})});}
 const index=JSON.stringify({schemaVersion:1,...release,resources});writeFileSync(join(root,'index'),index);
 const binding={schemaVersion:1,...release,index:{asset:'index',sha256:sha256(index)},resources:{integration:'integration',planSchema:'schema',descriptors:'descriptors'}};
 const p=structuredClone(plan);p.configurationReferences[0].disposition='realized';writeFileSync(join(root,'verification-fixtures.ts'),'fixture');writeFileSync(join(root,'fixture.ts'),'fixture');writeFileSync(join(root,'fixture.d.ts'),'declaration');writeFileSync(join(root,'reference.spec.ts'),'ordinary-source');writeFileSync(join(root,'raw.json'),'{}');
 const a=structuredClone(assignment),id=structuredClone(identity),m=structuredClone(manifest),e=structuredClone(evidence),r=structuredClone(record),bytes=JSON.stringify(p);
 a.planDigest=sha256(bytes);a.bindingDigest=sha256(JSON.stringify(binding));a.authorization.planDigest=a.planDigest;a.authorization.bindingDigest=a.bindingDigest;
 Object.assign(id,{planDigest:a.planDigest,bindingDigest:a.bindingDigest,assignmentDigest:sha256(JSON.stringify(a)),generatedSourceDigest:sourceDigest(root,['reference.spec.ts'])});m.identity=id;r.identity=id;
 const result=reconcile({plan:p,assignment:a,manifest:m,identity:id,records:[r],evidence:[e],outputRoot:root,runner:{exitCode:0,status:'passed'}});
 return {planBytes:bytes,binding,resolution:{root,indexPath:'index',mode:'execution'},projectRoot:root,assignment:a,manifest:m,result,evidence:[e],records:[r],outputRoot:root,sourceRoot:root};
}
