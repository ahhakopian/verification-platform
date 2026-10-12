import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {plan,assignment,identity,manifest,evidence} from '../tests/fixtures/execution.mjs';
import {sourceDigest} from '../dist/src/validation/result.js';
import {installedHookSelfCheck} from '../dist/runtime/invoke.js';
import {sha256} from '../dist/src/resources/resolve.js';
test('installed indexed hook loading execution and evidence machinery',async()=>{
 const bytes=readFileSync('resource-index.json'),index=JSON.parse(bytes);
 const binding={schemaVersion:1,repository:index.repository,tag:index.tag,sourceCommit:index.sourceCommit,index:{asset:'resource-index.json',sha256:sha256(bytes)},resources:{integration:'contracts/verification-integration.md',planSchema:'schemas/browser-verification-plan.schema.json',descriptors:'contracts/generic-descriptors.json'}};
 const parent=mkdtempSync(join(tmpdir(),'verification-installed-hook-'));
 const outputRoot=process.env.VERIFICATION_SELF_CHECK_ROOT??join(parent,'attempt');
 const report=await installedHookSelfCheck(binding,{root:process.cwd(),indexPath:'resource-index.json',mode:'execution'},outputRoot,process.env.VERIFICATION_EXECUTION_ID,Number(process.env.VERIFICATION_ATTEMPT??1));
 assert.equal(report.outcome,'PASS');assert.equal(report.synthetic,true);
 process.stdout.write(JSON.stringify({selfCheckReport:join(outputRoot,'self-check.json'),executionId:report.identity.executionId,attempt:report.identity.attempt})+'\n');
});
test('ordinary pinned runner annotations evidence attachments reporter compatibility',()=>{
 const directory=mkdtempSync(join(tmpdir(),'verification-ordinary-'));
 const current=structuredClone(identity);const mapped=structuredClone(manifest);
 mapped.entries[0].source='tests/fixtures/ordinary.spec.ts';mapped.entries[0].title='ordinary evidence API';
 current.generatedSourceDigest=sourceDigest(process.cwd(),[mapped.entries[0].source]);mapped.identity=current;
 const resultPath=join(directory,'result.json');const inputPath=join(directory,'input.json');
 writeFileSync(inputPath,JSON.stringify({plan,assignment,identity:current,manifest:mapped,evidence:[evidence],outputRoot:join(directory,'output'),resultPath}));
 const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/fixtures/ordinary.config.mjs'],{env:{...process.env,VERIFICATION_REFERENCE_INPUT:inputPath},encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stdout+run.stderr+String(run.error));
 const result=JSON.parse(readFileSync(resultPath,'utf8'));assert.equal(result.verdict,'PASS');assert.equal(result.runner.status,'passed');assert.equal(result.claims.length,1);assert.equal(result.claims[0].evidenceIds[0],'version-evidence');
});
