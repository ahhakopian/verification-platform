import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url);
const {followExecutionAttempt,acceptAttemptEvidence}=require('../../frontends/browser-verification/assets/follow-execution.cjs');
const request={executionId:'execution-one',attempt:1,evidencePath:'/tmp/attempt-one/result.json',command:{cmd:'assigned-single-operation',yield_time_ms:1000}};
function fixture(results){
 const records=new Map(),polls=[];let launches=0;
 const storage={get:key=>records.get(key),set:(key,value)=>records.set(key,structuredClone(value))};
 const tools={exec_command:async()=>{launches++;return results.shift();},write_stdin:async input=>{polls.push(input.session_id);return results.shift();}};
 return {storage,tools,polls,launches:()=>launches,records};
}
test('retains the returned session and follows that same execution to terminal completion once',async()=>{
 const f=fixture([{session_id:42,output:'start\n'},{session_id:42,output:'middle\n'},{exit_code:0,output:'end\n'}]);
 f.tools.write_stdin=async input=>{assert.equal([...f.records.values()][0].sessionId,42);f.polls.push(input.session_id);return f.polls.length===1?{session_id:42,output:'middle\n'}:{exit_code:0,output:'end\n'};};
 const result=await followExecutionAttempt(f.tools,f.storage,request,'start');
 assert.equal(result.status,'complete');assert.equal(result.sessionId,42);assert.equal(result.output,'start\nmiddle\nend\n');assert.deepEqual(f.polls,[42,42]);assert.equal(f.launches(),1);
 assert.deepEqual(await followExecutionAttempt(f.tools,f.storage,request,'start'),result);assert.equal(f.launches(),1);
});
test('resumes the stored handle without launching the operation again',async()=>{
 const f=fixture([{exit_code:0,output:'finished'}]);
 f.storage.set('browser-execution:execution-one:1',{...request,signature:JSON.stringify(request),status:'running',sessionId:7,output:'previous',exitCode:null});
 const result=await followExecutionAttempt(f.tools,f.storage,request);
 assert.equal(f.launches(),0);assert.deepEqual(f.polls,[7]);assert.equal(result.status,'complete');
});
test('accepts evidence only from the completed attempt and preserves distinct explicit retry identities',async()=>{
 const f=fixture([{exit_code:1,output:'first'},{exit_code:0,output:'retry'}]);
 const first=await followExecutionAttempt(f.tools,f.storage,request,'start');
 assert.throws(()=>acceptAttemptEvidence(first,{executionId:'other',attempt:1},request.evidencePath),/different execution/);
 assert.throws(()=>acceptAttemptEvidence(first,{executionId:request.executionId,attempt:2},request.evidencePath),/different execution/);
 assert.equal(acceptAttemptEvidence(first,{executionId:request.executionId,attempt:1},request.evidencePath).attempt,1);
 const retry={...request,executionId:'execution-two',attempt:2,evidencePath:'/tmp/attempt-two/result.json'};
 const second=await followExecutionAttempt(f.tools,f.storage,retry,'start');
 assert.equal(f.launches(),2);assert.equal(second.executionId,'execution-two');assert.equal(first.output,'first');assert.equal(second.output,'retry');
 await assert.rejects(followExecutionAttempt(f.tools,f.storage,{...request,evidencePath:retry.evidencePath},'start'),/identity changed/);
 assert.throws(()=>acceptAttemptEvidence(first,{executionId:request.executionId,attempt:1},retry.evidencePath),/Evidence path/);
});
test('missing handle or missing stored attempt blocks without implicit launch',async()=>{
 for(const state of [undefined,{status:'running',sessionId:null},{status:'launching',sessionId:null}]){
  const f=fixture([]);if(state)f.storage.set('browser-execution:execution-one:1',{...request,signature:JSON.stringify(request),output:'',...state});
  const result=await followExecutionAttempt(f.tools,f.storage,request,'follow');assert.equal(result.status,'blocked');assert.equal(f.launches(),0);assert.deepEqual(f.polls,[]);
  assert.throws(()=>acceptAttemptEvidence(result,{executionId:request.executionId,attempt:1}),/Terminal/);
 }
});
test('failed polling and changed handles do not relaunch or switch executions',async()=>{
 for(const failure of ['throw','changed','missing']){
  const f=fixture([{session_id:42,output:''}]);f.tools.write_stdin=async input=>{f.polls.push(input.session_id);if(failure==='throw')throw Error('lost session');return failure==='changed'?{session_id:43}:{output:''};};
  const result=await followExecutionAttempt(f.tools,f.storage,request,'start');assert.equal(result.status,'blocked');assert.equal(f.launches(),1);assert.deepEqual(f.polls,[42]);
  assert.equal((await followExecutionAttempt(f.tools,f.storage,request,'start')).status,'blocked');assert.equal(f.launches(),1);
 }
});

test('the rendered helper used by tools-only orchestration retains and follows the same handle',async()=>{
 let rendered='';const module={exports:{}};const require=()=>{};require.main=module;
 runInNewContext(readFileSync(new URL('../../frontends/browser-verification/assets/follow-execution.cjs',import.meta.url),'utf8'),{module,require,process:{argv:['node','helper','--render'],stdout:{write:value=>rendered+=value}}});
 const api=runInNewContext(rendered);const f=fixture([{session_id:9,output:'running'},{exit_code:0,output:'complete'}]);
 const result=await api.followExecutionAttempt(f.tools,f.storage,request,'start');
 assert.equal(result.status,'complete');assert.equal(result.sessionId,9);assert.equal(f.launches(),1);assert.equal(f.polls[0],9);
});
