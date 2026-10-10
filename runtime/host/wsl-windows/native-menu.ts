import {randomUUID} from 'node:crypto';
import type {Locator, Page, CDPSession} from '@playwright/test';
import type {OwnedSession} from '../../../src/contracts/index.js';
import {nativeOperation, type NativeMenuRequest, type NativeMenuAssociation, type NativeOperationInput, type NativeOperationObservation} from './native.js';
export interface NativeMenuCorrelation {
 /** Observations run on the borrowed page. The caller supplies the expected effect and its evidence source. */
 source:string;
 observe(page:Page):Promise<unknown>;
 matches(before:unknown,after:unknown):boolean;
}
export interface NativeMenuPathInput {
 /** Borrowed page/locator; caller authorizes a temporary title nonce, restored in the same document. */
 page:Page; source:Locator; path:string[]; hostSession:OwnedSession;
 host:Pick<NativeOperationInput,'powershell'|'runtimeConfig'>;
 deadlineMs:number; cleanupMs?:number; signal?:AbortSignal; initiation:'right-click'|'keyboard';
 correlation?:NativeMenuCorrelation;
}
export interface NativeMenuPathResult {
 status:'invoked'|'blocked'|'uncertain'; verdict:'PASS'|'FAIL'|'BLOCKED'|'INCONCLUSIVE'; phase:string; attempted:boolean;
 startedAt:string; finishedAt:string; lifecycleId:string; runtime?:NativeMenuRequest['runtime']; targetId?:string; path:string[];
 observations:NativeOperationObservation[]; cleanupErrors:string[]; detail?:string;
 correlation?:{source:string;before:unknown;after?:unknown;beforeAt:string;afterAt?:string;matched?:boolean};
 initiationEvidence?:{method:string;targetId:string;domIdentity:{backendNodeId:number;documentToken:string};identityConfirmed:boolean;events:Array<{type:'mousePressed'|'mouseReleased';button:'right';buttons:number;clickCount:number;x:number;y:number;sentAt?:string;acknowledgedAt?:string}>;box:{x:number;y:number;width:number;height:number};coordinates:{x:number;y:number};observedAt:string};
 limits:string[];
}
interface NodeInfo {name:string;runtimeId:number[];patterns:string[]}
function info(value:unknown):NodeInfo {
 const node=value as NodeInfo;
 if(!node||typeof node.name!=='string'||!Array.isArray(node.runtimeId)||!node.runtimeId.length||node.runtimeId.some(id=>!Number.isInteger(id)))throw Error('Native runtime identity missing');
 return node;
}
function data(result:NativeOperationObservation):unknown {
 const observation=result.observation as {status?:string;data?:unknown;detail?:string}|undefined;
 if(result.category!=='observation'||observation?.status!=='ok')throw Error(observation?.detail??'Native menu observation unavailable');
 return observation.data;
}
/** A supported semantic invocation proves interaction; optional correlated browser evidence establishes only the caller's specified outcome. */
export async function nativeMenuPath(input:NativeMenuPathInput):Promise<NativeMenuPathResult>{
 const result:NativeMenuPathResult={status:'blocked',verdict:'BLOCKED',phase:'binding',attempted:false,lifecycleId:randomUUID(),startedAt:new Date().toISOString(),finishedAt:'',path:[...input.path],observations:[],cleanupErrors:[],limits:['UIA invocation alone does not establish Chrome callback data or product outcome','Separate popup attribution requires UIA ancestry or native HWND owner relationship, expanded parent and unique live popup','Live support is limited to the documented Chrome for Testing 154.0.8037.92 browser-associated right-click path; arbitrary native menus and other versions remain unestablished']};
 const deadline=performance.now()+input.deadlineMs;
 const remaining=()=>{const ms=deadline-performance.now();if(ms<=0||input.signal?.aborted||input.page.isClosed())throw Error('Native menu deadline, cancellation or source-page loss');return ms;};
 async function bounded<T>(operation:()=>Promise<T>):Promise<T>{
  const ms=remaining();let timer:ReturnType<typeof setTimeout>|undefined;let cancel:(()=>void)|undefined;
  try{return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Native menu deadline exceeded')),ms);cancel=()=>reject(Error('Native menu cancelled'));input.signal?.addEventListener('abort',cancel,{once:true});})]);}
  finally{if(timer)clearTimeout(timer);if(cancel)input.signal?.removeEventListener('abort',cancel);}
 }
 let session:CDPSession|undefined;let originalTitle:string|undefined;let documentToken:string|undefined;
 const nonce='vp-menu-'+result.lifecycleId;let uncertainInput=false;
 const continuity=async()=>{await bounded(()=>input.hostSession.revalidate());if(!session)throw Error('Source CDP session missing');const live=await bounded(()=>session!.send('Target.getTargetInfo'));if(live.targetInfo.targetId!==result.targetId)throw Error('Browser source target changed');};
 const call=async(operation:NativeOperationInput['operation'],menu:NativeMenuRequest)=>{remaining();const observation=await nativeOperation({...input.host,operation,menu,deadlineMs:remaining(),signal:input.signal});result.observations.push(observation);if(observation.attempted)result.attempted=true;if(observation.uncertain){result.status='uncertain';result.verdict='INCONCLUSIVE';}return data(observation);};
 try {
  if(!Number.isFinite(input.deadlineMs)||input.deadlineMs<=0||!input.path.length||input.path.some(label=>typeof label!=='string'||!label))throw Error('Positive bounded deadline and nonempty exact menu labels required');
  if(!['right-click','keyboard'].includes(input.initiation))throw Error('Explicit supported menu initiation required');
  if(input.correlation&&(!input.correlation.source||typeof input.correlation.observe!=='function'||typeof input.correlation.matches!=='function'))throw Error('Correlation requires a named browser evidence source and observation/match functions');
  if(input.source.page()!==input.page)throw Error('Menu source locator belongs to another page');
  await bounded(()=>input.hostSession.revalidate());session=await bounded(()=>input.page.context().newCDPSession(input.page));
  result.targetId=(await bounded(()=>session!.send('Target.getTargetInfo'))).targetInfo.targetId;
  originalTitle=await bounded(()=>input.page.title());
  documentToken=await bounded(()=>input.page.evaluate(()=>String(performance.timeOrigin)));
  await bounded(()=>input.page.evaluate(nonce=>{document.title=nonce;},nonce));
  if(input.initiation==='keyboard')await bounded(()=>input.page.bringToFront());
  const menu:NativeMenuRequest={targetId:result.targetId,nonce,foregroundFree:input.initiation==='right-click'};
  const binding=await call('menu-bind',menu) as {window:NodeInfo;runtime:NonNullable<NativeMenuRequest['runtime']>;menuRoots:NodeInfo[]};
  menu.windowRuntimeId=info(binding.window).runtimeId;menu.runtime=binding.runtime;result.runtime=binding.runtime;
  if(!Array.isArray(binding.menuRoots)||binding.menuRoots.length)throw Error('Source already has a native menu; fresh popup lifecycle is unproved');
  if(input.initiation==='keyboard'){result.phase='focus';await continuity();await call('menu-focus',menu);menu.requireForeground=true;}
  if(input.correlation){const before=await bounded(()=>input.correlation!.observe(input.page));result.correlation={source:input.correlation.source,before,beforeAt:new Date().toISOString()};}
  result.phase='initiation';await continuity();await call('menu-bind',menu);
  if(input.initiation==='right-click'){
   const retained=await bounded(()=>input.source.elementHandle({timeout:remaining()}));
   if(!retained)throw Error('Exact DOM source missing');
   try{
    const fresh=await bounded(()=>input.source.elementHandle({timeout:remaining()}));
    if(!fresh)throw Error('Exact DOM source missing');
    const identical=await bounded(()=>retained.evaluate((element,other)=>element===other&&element.isConnected,fresh));
    await fresh.dispose();if(!identical)throw Error('Exact DOM source identity changed');
    const box=await bounded(()=>retained.boundingBox());
    if(!box||box.width<=0||box.height<=0)throw Error('Fresh source geometry unavailable');
    const coordinates={x:box.x+box.width/2,y:box.y+box.height/2};
    const hit=await bounded(()=>retained.evaluate((element,point)=>{const hit=element.ownerDocument.elementFromPoint(point.x,point.y);return element.isConnected&&(hit===element||element.contains(hit));},coordinates));
    if(!hit)throw Error('Source geometry does not hit retained DOM source');
    await bounded(()=>input.page.evaluate(({element,key})=>{Object.defineProperty(globalThis,key,{value:element,configurable:true});},{element:retained,key:nonce}));
    const remote=await bounded(()=>session!.send('Runtime.evaluate',{expression:`globalThis[${JSON.stringify(nonce)}]`}));
    if(!remote.result.objectId)throw Error('Concrete CDP DOM identity unavailable');
    const objectId=remote.result.objectId;
    const described=await bounded(()=>session!.send('DOM.describeNode',{objectId}));
    if(!Number.isInteger(described.node.backendNodeId)||described.node.backendNodeId<=0)throw Error('Concrete CDP backend DOM identity unavailable');
    await bounded(()=>session!.send('Runtime.releaseObject',{objectId}));
    const events=[{type:'mousePressed' as const,button:'right' as const,buttons:2,clickCount:1,...coordinates},{type:'mouseReleased' as const,button:'right' as const,buttons:0,clickCount:1,...coordinates}];
    await continuity();
    if(await bounded(()=>input.page.evaluate(()=>String(performance.timeOrigin)))!==documentToken)throw Error('Source document changed before CDP input');
    if(!await bounded(()=>retained.evaluate(element=>element.isConnected)))throw Error('Exact DOM source detached before CDP input');
    result.initiationEvidence={method:'target-scoped CDP Input.dispatchMouseEvent',targetId:result.targetId!,domIdentity:{backendNodeId:described.node.backendNodeId,documentToken:documentToken!},events:[],identityConfirmed:true,box,coordinates,observedAt:new Date().toISOString()};
    result.attempted=true;uncertainInput=true;
    for(const event of events){const sent={...event,sentAt:new Date().toISOString(),acknowledgedAt:undefined as string|undefined};result.initiationEvidence.events.push(sent);await bounded(()=>session!.send('Input.dispatchMouseEvent',event));sent.acknowledgedAt=new Date().toISOString();}
   }finally{await input.page.evaluate(key=>{delete (globalThis as unknown as Record<string,unknown>)[key];},nonce).catch(()=>{});await retained.dispose();}
  }
  else if(input.initiation==='keyboard'){result.attempted=true;uncertainInput=true;await bounded(()=>input.source.focus({timeout:remaining()}));await bounded(()=>input.source.press('Shift+F10',{timeout:remaining()}));}
  else throw Error('Explicit supported menu initiation required');
  uncertainInput=false;result.phase='selection';
  const roots=await call('menu-tree',menu);
  if(!Array.isArray(roots)||roots.length!==1)throw Error('Native menu root missing or ambiguous');
  menu.rootRuntimeId=info(roots[0]).runtimeId;menu.ancestors=[];
  for(let index=0;index<input.path.length;index++){
   menu.path=[input.path[index]];
   const tree=await call('menu-tree',menu) as {item:NodeInfo};menu.elementRuntimeId=info(tree.item).runtimeId;
   const operation=index===input.path.length-1?'menu-invoke':'menu-expand';result.phase=operation;
   await continuity();const action=await call(operation,menu) as {association?:NativeMenuAssociation};
   menu.association=action.association;
   if(operation==='menu-expand'){
    const children=await call('menu-next',menu);
    if(Array.isArray(children)&&children.length===1&&(children[0] as {association?:NativeMenuAssociation}).association)menu.association=(children[0] as {association:NativeMenuAssociation}).association;
    if(!Array.isArray(children)||children.length!==1)throw Error('Native submenu root missing or ambiguous');
    menu.ancestors.push({rootRuntimeId:menu.rootRuntimeId!,elementRuntimeId:menu.elementRuntimeId,label:input.path[index],...(menu.association?{association:menu.association}:{})});
    menu.rootRuntimeId=info(children[0]).runtimeId;menu.association=undefined;
   }
  }
  result.phase='outcome';await continuity();
  if(input.correlation){const after=await bounded(()=>input.correlation!.observe(input.page));await continuity();const record=result.correlation!;record.after=after;record.afterAt=new Date().toISOString();record.matched=input.correlation.matches(record.before,after);result.verdict=record.matched?'PASS':'FAIL';}
  else result.verdict='PASS';
  result.status='invoked';
 }catch(error){result.detail=error instanceof Error?error.message:String(error);if(uncertainInput||(result.phase==='outcome'&&result.attempted)){result.status='uncertain';result.verdict='INCONCLUSIVE';}}
 finally {
  // Cleanup has its own bounded budget, including after cancellation/action expiry.
  const cleanupDeadline=performance.now()+(input.cleanupMs??5000);
  async function cleanup(operation:()=>Promise<unknown>){let timer:ReturnType<typeof setTimeout>|undefined;try{const ms=cleanupDeadline-performance.now();if(ms<=0)throw Error('Native menu cleanup deadline exceeded');await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Native menu cleanup deadline exceeded')),ms);})]);}finally{if(timer)clearTimeout(timer);}}
  if(originalTitle!==undefined&&documentToken!==undefined&&!input.page.isClosed())try{await cleanup(()=>input.page.evaluate(({nonce,title,token})=>{if(String(performance.timeOrigin)===token&&document.title===nonce)document.title=title;},{nonce,title:originalTitle!,token:documentToken!}));}catch(error){result.cleanupErrors.push(String(error));}
  if(session)try{await cleanup(()=>session!.detach());}catch(error){result.cleanupErrors.push(String(error));}
  if(result.cleanupErrors.length){result.status='uncertain';result.verdict='INCONCLUSIVE';}
  result.finishedAt=new Date().toISOString();
 }
 return result;
}
