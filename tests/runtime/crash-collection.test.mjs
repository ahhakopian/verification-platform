import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,cpSync} from 'node:fs';import {join} from 'node:path';
import {currentResultFixture} from '../fixtures/current-result.mjs';
import {invokePlaywright} from '../../dist/runtime/invoke.js';
test('crash collection ignores Playwright attachment copies and preserves decisive contradiction',async()=>{
 const f=currentResultFixture(),root=f.projectRoot,output=join(root,'output'),copied=join(output,'attachments');mkdirSync(copied,{recursive:true});
 const evidence=structuredClone(f.evidence[0]);evidence.attachment.path=join(root,'raw.json');
 // Keep attachments inside the assigned output scope.
 cpSync(join(root,'raw.json'),join(output,'raw.json'));evidence.attachment.path=join(output,'raw.json');
 const record={...f.records[0],outcome:'contradicted',reason:'Decisive current fixture contradiction'};
 for(const [name,value] of [['evidence-original.json',evidence],['claim-original.json',record]]){writeFileSync(join(output,name),JSON.stringify(value));cpSync(join(output,name),join(copied,name));}
 writeFileSync(join(root,'runner.mjs'),'process.exitCode=1;');
 const returned=await invokePlaywright({plan:JSON.parse(f.planBytes),assignment:f.assignment,manifest:f.manifest,identity:f.manifest.identity,outputRoot:output,cwd:root,resultPath:join(root,'crash-result.json'),runnerEntry:join(root,'runner.mjs'),config:'unused'});
 assert.equal(returned.result.verdict,'FAIL');assert.equal(returned.result.runner.status,'incomplete-collection');assert.equal(returned.runnerExitCode,1);assert.equal(returned.acceptanceExitCode,1);
 assert.deepEqual(returned.result.claims[0].evidenceIds,['version-evidence']);assert(!returned.result.limitations.some(x=>x.includes('Rejected evidence identity/format')));
});
