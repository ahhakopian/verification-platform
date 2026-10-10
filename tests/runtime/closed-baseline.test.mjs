import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {chromium} from '@playwright/test';
import {prepareClosedBrowserBaseline} from '../../dist/runtime/host/wsl-windows/session.js';
const config={runtimeConfig:'fixture.json',powershell:'fixture',launch:true,readinessMs:1000,disposalMs:10};
const identity={status:'ok',binary:'C:\\fixture\\chrome.exe',profile:'C:\\fixture\\profile',version:'fixture',process_id:123,started_at:'start',webSocketDebuggerUrl:'ws://127.0.0.1:9222/devtools/browser/current'};
const running={...identity,state:'RUNNING'};
const stopped={status:'ok',state:'STOPPED',binary:identity.binary,profile:identity.profile,version:identity.version,profileProcessCount:0,listenerCount:0};
function mock(t,observations,{closeError,provenance=identity}={}){
 const calls=[],actions=[];
 const spy=t.mock.method(childProcess,'spawn',(command,args)=>{
  calls.push({command,args});const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.exitCode=null;
  c.kill=()=>{queueMicrotask(()=>{c.exitCode=0;c.emit('close',0);});return true;};
  queueMicrotask(()=>{
   if(args[0]==='-c'){
    const observation=args[1].includes('closed_baseline()')?observations.shift():identity;
    assert(observation,'Unexpected probe');c.stdout.write(JSON.stringify(observation));c.exitCode=observation.status==='BLOCKED'?1:0;c.emit('close',c.exitCode);
   }else c.stdout.write(JSON.stringify({...provenance,cdp_endpoint:'ws://127.0.0.1:1111/devtools/browser/current'})+'\n');
  });return c;
 });syncBuiltinESMExports();t.after(()=>{spy.mock.restore();syncBuiltinESMExports();});
 t.mock.method(chromium,'connectOverCDP',async()=>({newBrowserCDPSession:async()=>({send:async method=>{actions.push(method);if(closeError)throw Error(closeError);}}),close:async()=>actions.push('detach')}));
 return {calls,actions};
}
function noLaunch(calls){assert(calls.every(c=>!c.args.includes('--launch')));assert(calls.every(c=>!c.args.includes('ensure')));}
test('required CLOSED already absent is READY without attachment, close or launch',async t=>{
 const m=mock(t,[stopped]);const r=await prepareClosedBrowserBaseline(config,false);
 assert.equal(r.status,'READY');assert.equal(r.resetAttempted,false);assert.deepEqual(m.actions,[]);assert.equal(m.calls.length,1);noLaunch(m.calls);
});
test('authorized exact running browser closes once and verifies stopped without launching',async t=>{
 const m=mock(t,[running,running,stopped]);const r=await prepareClosedBrowserBaseline(config,true);
 assert.equal(r.status,'READY');assert.equal(r.resetAttempted,true);assert.equal(r.observations.at(-1).state,'STOPPED');assert.deepEqual(m.actions,['Browser.close','detach']);noLaunch(m.calls);
});
test('ambiguous baseline remains BLOCKED without attachment or reset',async t=>{
 const m=mock(t,[{status:'BLOCKED',detail:'Configured browser/profile/listener baseline is ambiguous or unhealthy.'}]);
 const r=await prepareClosedBrowserBaseline(config,true);assert.equal(r.status,'BLOCKED');assert.match(r.reason,/ambiguous/);assert.deepEqual(m.actions,[]);noLaunch(m.calls);
});
test('unauthorized running browser reset is BLOCKED and leaves it untouched',async t=>{
 const m=mock(t,[running]);const r=await prepareClosedBrowserBaseline(config,false);
 assert.equal(r.status,'BLOCKED');assert.match(r.reason,/not authorized/);assert.equal(r.resetAttempted,false);assert.equal(m.calls.length,1);assert.deepEqual(m.actions,[]);noLaunch(m.calls);
});
test('failed reset is BLOCKED without another close or launch',async t=>{
 const m=mock(t,[running],{closeError:'close failed'});const r=await prepareClosedBrowserBaseline(config,true);
 assert.equal(r.status,'BLOCKED');assert.match(r.reason,/close failed/);assert.deepEqual(m.actions,['Browser.close','detach']);noLaunch(m.calls);
});
test('absence must be proven after reset; ambiguous verification is BLOCKED',async t=>{
 const m=mock(t,[running,{status:'BLOCKED',detail:'Unknown listener owner'}]);const r=await prepareClosedBrowserBaseline(config,true);
 assert.equal(r.status,'BLOCKED');assert.match(r.reason,/Unknown listener/);assert.deepEqual(m.actions,['Browser.close','detach']);noLaunch(m.calls);
});
test('changed incarnation cannot authorize closing a different browser',async t=>{
 const m=mock(t,[running],{provenance:{...identity,process_id:456}});const r=await prepareClosedBrowserBaseline(config,true);
 assert.equal(r.status,'BLOCKED');assert.match(r.reason,/identity changed/);assert.equal(r.resetAttempted,false);assert.deepEqual(m.actions,[]);noLaunch(m.calls);
});
