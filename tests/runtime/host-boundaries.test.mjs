import test from 'node:test';import assert from 'node:assert/strict';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {acquireSession} from '../../dist/runtime/host/wsl-windows/session.js';
import {nativeOperation} from '../../dist/runtime/host/wsl-windows/native.js';
function child(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin=new PassThrough();c.exitCode=null;c.kill=()=>true;return c;}
test('failed session readiness removes cancellation listeners and preserves original error plus owned cleanup limitation',async(t)=>{
 const listeners=new Set(),signal=new EventTarget();signal.aborted=false;
 const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
 signal.addEventListener=(type,listener,...args)=>{if(type==='abort')listeners.add(listener);return add(type,listener,...args);};signal.removeEventListener=(type,listener,...args)=>{if(type==='abort')listeners.delete(listener);return remove(type,listener,...args);};
 const spawned=child(),mock=t.mock.method(childProcess,'spawn',()=>{setImmediate(()=>spawned.stdout.write('malformed readiness\n'));return spawned;});syncBuiltinESMExports();
 try {await assert.rejects(()=>acquireSession({runtimeConfig:'fixture',powershell:'fixture',launch:false,readinessMs:100,disposalMs:1,signal}),error=>{assert(error.cause instanceof SyntaxError);assert.match(error.raw.stdout,/malformed readiness/);assert(error.cleanupErrors.some(e=>e.includes('Owned relay disposal deadline')));return true;});assert.equal(listeners.size,0);}finally{mock.mock.restore();syncBuiltinESMExports();}
});
test('native method uses one absolute deadline across conversion and invocation without attempting action after expiry',async(t)=>{
 const calls=[],mock=t.mock.method(childProcess,'spawn',(command,args)=>{calls.push(command);const c=child();const timer=setTimeout(()=>{c.stdout.write('fixture-converted-path\n');c.exitCode=0;c.emit('close',0);},120);c.kill=()=>{clearTimeout(timer);queueMicrotask(()=>c.emit('close',null));return true;};return c;});syncBuiltinESMExports();const start=performance.now();
 try {const result=await nativeOperation({operation:'invoke',powershell:'must-not-run',runtimeConfig:'fixture',deadlineMs:180});assert.equal(result.attempted,false);assert.equal(result.phase,'readiness');assert.equal(calls.length,2);assert(calls.every(c=>c==='wslpath'));assert(performance.now()-start<350);}finally{mock.mock.restore();syncBuiltinESMExports();}
});

test('host passes the assigned readiness budget to helper rather than a hidden transport deadline',async(t)=>{
 let argumentsSeen;const spawned=child();spawned.kill=()=>{queueMicrotask(()=>spawned.emit('close',0));return true;};
 const mock=t.mock.method(childProcess,'spawn',(command,args)=>{argumentsSeen=args;setImmediate(()=>spawned.stdout.write(JSON.stringify({status:'ok',cdp_endpoint:'ws://127.0.0.1:123/devtools/browser/current',process_id:123,started_at:'fixture',webSocketDebuggerUrl:'ws://127.0.0.1:9222/devtools/browser/current'})+'\n'));return spawned;});syncBuiltinESMExports();
 try{const session=await acquireSession({runtimeConfig:'fixture',powershell:'fixture',launch:false,readinessMs:120000,disposalMs:10});assert.equal(argumentsSeen[argumentsSeen.indexOf('--readiness-ms')+1],'120000');await session.dispose();}finally{mock.mock.restore();syncBuiltinESMExports();}
});

test('native cancellation after possible invocation retains uncertainty and never repeats',async(t)=>{
 const controller=new AbortController();let invocations=0;
 const mock=t.mock.method(childProcess,'spawn',(command)=>{const c=child();c.kill=()=>{queueMicrotask(()=>c.emit('close',null));return true;};if(command==='wslpath'){queueMicrotask(()=>{c.stdout.write('fixture-path\n');c.exitCode=0;c.emit('close',0);});}else{invocations++;queueMicrotask(()=>controller.abort());}return c;});syncBuiltinESMExports();
 try{const result=await nativeOperation({operation:'invoke',powershell:'fixture-powershell',runtimeConfig:'fixture',deadlineMs:1000,signal:controller.signal});assert.equal(result.category,'timeout');assert.equal(result.attempted,true);assert.equal(result.uncertain,true);assert.equal(invocations,1);}finally{mock.mock.restore();syncBuiltinESMExports();}
});
