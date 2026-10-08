import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';import {join} from 'node:path';
import {validateResult} from '../../dist/src/validation/result.js';
import {currentResultFixture as fixture} from '../fixtures/current-result.mjs';

test('current complete result validates actual normative resources and source/provider bytes',()=>{assert.deepEqual(validateResult(fixture()),{valid:true,verdict:'PASS',diagnostics:[]});});
test('malformed manifest returns structured blocked result before identity dereference',()=>{const f=fixture();f.manifest={schemaVersion:1};assert.equal(validateResult(f).verdict,'BLOCKED');assert.equal(validateResult(f).valid,false);});
test('changed same-version provider/declaration or generated source invalidates returned PASS',()=>{for(const path of ['fixture.ts','fixture.d.ts','reference.spec.ts']){const f=fixture();writeFileSync(join(f.projectRoot,path),'changed');const result=validateResult(f);assert.equal(result.valid,false);assert.equal(result.verdict,'BLOCKED');}});
test('missing required attachment and forged green result cannot pass current reconciliation',()=>{const f=fixture();f.evidence[0].attachment.path='missing';const result=validateResult(f);assert.equal(result.valid,false);assert.equal(result.verdict,'INCONCLUSIVE');});
test('assigned provider identity cannot omit its implementation/declaration source coverage',()=>{const f=fixture();f.manifest.identity.providerSources=[];f.result.identity.providerSources=[];assert.equal(validateResult(f).valid,false);assert.equal(validateResult(f).verdict,'BLOCKED');});
