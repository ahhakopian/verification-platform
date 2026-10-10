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
