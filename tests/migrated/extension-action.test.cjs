'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {browserCDP, discoverTargets, selectTarget, discoverExtension, triggerExtensionAction, renderRunCode} = require('../../runtime/cdp/extension-action.cjs');
const filter = [{type:'tab',exclude:false},{exclude:true}];
const options = {extensionId:'fixture-extension',target:{filter,criteria:{url:'https://fixture.invalid/one'}}};
const tab = {targetId:'fixture-tab',type:'tab',url:options.target.criteria.url};
function fixture({extensions=[{id:options.extensionId}],targets=[tab],errorMethod}={}) {
  const calls=[]; let detached=0;
  const cdp={async send(method,params) {
    calls.push({method,params});
    if(method===errorMethod) {const error=new Error(`Protocol error: ${method}`);error.code=-32000;error.data={fixture:true};throw error;}
    if(method==='Extensions.getExtensions') return {extensions};
    if(method==='Target.getTargets') return {targetInfos:targets};
    if(method==='Extensions.triggerAction') return {};
    throw new Error('Unexpected command');
  },async detach(){detached++;}};
  const browser={async newBrowserCDPSession(){return cdp;}};
  return {cdp,browser,calls,detached:()=>detached,run:()=>triggerExtensionAction(browser,options)};
}
test('generic browser CDP uses existing attachment',async()=>{
 const f=fixture();assert.equal(await browserCDP(f.browser),f.cdp);
 await assert.rejects(browserCDP(null),/attachment/);
});
test('generic explicit target filtering and criteria support arbitrary target types',async()=>{
 const f=fixture({targets:[{targetId:'worker',type:'service_worker',url:'chrome-extension://fixture/worker.js'}]});
 const workerFilter=[{type:'service_worker',exclude:false},{exclude:true}];
 const targets=await discoverTargets(f.cdp,workerFilter);
 assert.deepEqual(f.calls[0].params,{filter:workerFilter});
 assert.equal(selectTarget(targets,{type:'service_worker',targetId:'worker'}).targetId,'worker');
 await assert.rejects(discoverTargets(f.cdp,undefined),/filter/);
});
test('exact target selection rejects missing, ambiguity and empty criteria',()=>{
 assert.throws(()=>selectTarget([tab,tab],{url:tab.url}),/exactly one/);
 assert.throws(()=>selectTarget([],{url:tab.url}),/exactly one/);
 assert.throws(()=>selectTarget([tab],{}),/criteria/);
});
test('generic extension ID discovery rejects absent and duplicate ID',async()=>{
 for (const extensions of [[],[{id:options.extensionId},{id:options.extensionId}]]) {
  await assert.rejects(discoverExtension(fixture({extensions}).cdp,options.extensionId),/exactly one/);
 }
 const f=fixture({extensions:[{id:'second-extension'}]});
 assert.equal((await discoverExtension(f.cdp,'second-extension')).id,'second-extension');
});
test('action discovers tab and sends verified extension ID and target ID once',async()=>{
 const f=fixture();const result=await f.run();assert.equal(result.status,'ok');assert.equal(result.invoked,true);
 assert.deepEqual(result.command_result,{});assert.equal(f.detached(),1);
 assert.deepEqual(f.calls,[{method:'Extensions.getExtensions',params:undefined},
  {method:'Target.getTargets',params:{filter}},
  {method:'Extensions.triggerAction',params:{id:options.extensionId,targetId:tab.targetId}}]);
});
test('page target and explicit page criteria cannot trigger extension action',async()=>{
 const f=fixture({targets:[{...tab,type:'page'}]});
 assert.equal((await f.run()).invoked,false);assert.equal(f.calls.length,2);
 const explicit=fixture();
 assert.equal((await triggerExtensionAction(explicit.browser,{...options,target:{filter,criteria:{type:'page',url:tab.url}}})).invoked,false);
 assert.equal(explicit.calls.length,0);
});
test('ambiguous tabs and extensions stop with no trigger or fallback',async()=>{
 for(const input of [{targets:[tab,{...tab,targetId:'second'}]},{extensions:[{id:options.extensionId},{id:options.extensionId}]}]) {
  const f=fixture(input);const result=await f.run();assert.equal(result.status,'ambiguous');assert.equal(result.invoked,false);
  assert.ok(!f.calls.some(call=>call.method==='Extensions.triggerAction'));assert.equal(f.detached(),1);
 }
});
test('protocol error details propagate at all commands without alternative actions',async()=>{
 for(const method of ['Extensions.getExtensions','Target.getTargets','Extensions.triggerAction']) {
  const f=fixture({errorMethod:method});const result=await f.run();
  assert.equal(result.status,'error');assert.equal(result.invoked,false);
  assert.deepEqual(result.protocol_error,{name:'Error',message:`Protocol error: ${method}`,code:-32000,data:{fixture:true}});
  assert.equal(f.calls.at(-1).method,method);assert.equal(f.detached(),1);
 }
});
test('rendered run-code is self-contained in existing page attachment',async()=>{
 const f=fixture();const run=vm.runInNewContext(`(${renderRunCode(options)})`,{});
 assert.equal((await run({context:()=>({browser:()=>f.browser})})).status,'ok');
});
test('a fresh invocation discovers changed targets rather than caching target IDs',async()=>{
 const first=fixture();await first.run();const next=fixture({targets:[{...tab,targetId:'new-tab'}]});await next.run();
 assert.equal(next.calls.at(-1).params.targetId,'new-tab');
});
