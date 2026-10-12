import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const files=['frontends/browser-verification/agents/browser-luna.toml.template','frontends/browser-verification/agents/browser-sol.toml.template'];
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
function settings(source){
 return {
  name:source.match(/^name = "([^"]+)"$/m)?.[1],
  model:source.match(/^model = "([^"]+)"$/m)?.[1],
  reasoning:source.match(/^model_reasoning_effort = "([^"]+)"$/m)?.[1]
 };
}

test('canonical browser agent templates retain the intended primary and escalation models',()=>{
 assert.deepEqual(settings(read(files[0])),{name:'browser_luna',model:'gpt-6-luna',reasoning:'medium'});
 assert.deepEqual(settings(read(files[1])),{name:'browser_sol',model:'gpt-6-luna',reasoning:'high'});
 assert.match(read('dist/frontends/browser-verification/agents/browser-luna.toml.template'),/^model = "gpt-6-luna"$/m);
 assert.match(read('dist/frontends/browser-verification/agents/browser-luna.toml.template'),/^model_reasoning_effort = "medium"$/m);
 assert.match(read('dist/frontends/browser-verification/agents/browser-sol.toml.template'),/^model = "gpt-6-luna"$/m);
 assert.match(read('dist/frontends/browser-verification/agents/browser-sol.toml.template'),/^model_reasoning_effort = "high"$/m);
});

test('all selection authority surfaces require one explicit user decision before concrete selection or use',()=>{
 const frontends=['frontends/browser-verification/SKILL.md',...files,'frontends/verification-orchestrator/SKILL.md'];
 const sources=[...frontends,'contracts/contracts.md','contracts/verification-integration.md','docs/architecture/verification-platform.md','docs/architecture/verification-platform-preflight.md','runtime/host/wsl-windows/wsl-windows-chrome-current.md'];
 for(const candidate of [...sources,...frontends.map(path=>'dist/'+path),'dist/runtime/host/wsl-windows/wsl-windows-chrome-current.md']){
  const text=read(candidate);
  assert.doesNotMatch(text,/Select no browser, version, profile, site or account implicitly\./,candidate);
  assert.doesNotMatch(text,/autonomously discover and select|frontend may discover and select|autonomous frontend discovery\/selection/,candidate);
  assert.match(text,/Before selecting or using any concrete browser, browser version, profile, site or account for verification, obtain explicit user approval/,candidate);
  assert.match(text,/autonomously discover suitable candidates and derive their technical details/,candidate);
  assert.match(text,/must not commit to or use a candidate before approval/,candidate);
  assert.match(text,/together as one authorization decision/,candidate);
  assert.match(text,/do not ask the user to supply discoverable technical values/,candidate);
  assert.match(text,/Honor explicit user\/task constraints/,candidate);
  assert.match(text,/existing explicit user approval only when it covers the exact proposed selection/,candidate);
  assert.match(text,/After approval, record the approved selection/,candidate);
  assert.match(text,/Host Runtime \/ BrowserPreflight identity validation and continuity guarantees/,candidate);
  assert.match(text,/Selection approval does not authorize other restricted actions/,candidate);
  assert.match(text,/a changed selection requires explicit user approval/,candidate);
 }
 for(const path of files){
  for(const candidate of [path,'dist/'+path]){
   const policy=read(candidate).split('[auto_review]')[1];
   assert.match(policy,/to discover suitable candidates within the task/);
   assert.match(policy,/concrete selection explicitly approved by the user/);
   assert.match(policy,/Automatic approval review cannot supply that selection approval/);
   assert.match(policy,/retain existing authorization requirements/);
   assert.match(policy,/Do not approve unrelated commands, profile deletion/);
  }
 }
});
