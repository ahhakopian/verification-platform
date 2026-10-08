import type {Browser} from '@playwright/test';
import {browserCDP,discoverTargets,selectTarget,type Target} from './extension-action.cjs';
const filter=[{type:'worker',exclude:false},{exclude:true}];
export interface WorkerAssignment {targetId:string;url:string;deadlineMs:number;wake:()=>Promise<void>}
export interface WorkerInterruption {stopped:Target;replacement:Target;sessionId:string;dispose:()=>Promise<void>;limits:string[]}
/** Assigned dedicated-worker control only. Wake is a separate caller-authorized action. */
export async function interruptWorker(browser:Browser,input:WorkerAssignment):Promise<WorkerInterruption>{
 if(!input.targetId||!input.url||!Number.isFinite(input.deadlineMs)||input.deadlineMs<=0)throw Error('Exact assigned worker and positive deadline required');
 const cdp=await browserCDP(browser);const deadline=performance.now()+input.deadlineMs;let attached:string|undefined,disposed=false;
 const dispose=async()=>{if(disposed)return;disposed=true;try{if(attached)await cdp.send('Target.detachFromTarget',{sessionId:attached});}finally{await cdp.detach();}};
 const bounded=async<T>(operation:()=>Promise<T>,phase:string):Promise<T>=>{const remaining=deadline-performance.now();if(remaining<=0)throw Error(phase+' deadline expired');let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(phase+' deadline expired; possible action effects remain uncertain')),remaining);})]);}finally{if(timer)clearTimeout(timer);}};
 const waitDestroyed=(targetId:string)=>{let listener:(event:{targetId:string})=>void;let timer:ReturnType<typeof setTimeout>;const promise=new Promise<void>((resolve,reject)=>{listener=event=>{if(event.targetId===targetId){clearTimeout(timer);cdp.removeListener('Target.targetDestroyed',listener);resolve();}};cdp.on('Target.targetDestroyed',listener);timer=setTimeout(()=>{cdp.removeListener('Target.targetDestroyed',listener);reject(Error('worker destruction not observed before deadline; stop effects uncertain'));},Math.max(0,deadline-performance.now()));});void promise.catch(()=>{});return {promise,cancel(){clearTimeout(timer);cdp.removeListener('Target.targetDestroyed',listener);}};};
 try{
  await bounded(()=>cdp.send('Target.setDiscoverTargets',{discover:true,filter}),'worker observation readiness');
  const stopped=selectTarget(await bounded(()=>discoverTargets(cdp,filter),'worker discovery'),{targetId:input.targetId,url:input.url,type:'worker'});
  const destruction=waitDestroyed(stopped.targetId);
  try{const response=await bounded(()=>cdp.send('Target.closeTarget',{targetId:stopped.targetId}),'worker stop');if(response.success!==true)throw Error('Assigned worker stop unavailable: Target.closeTarget did not accept');await destruction.promise;}finally{destruction.cancel();}
  await bounded(input.wake,'separately assigned worker wake');
  const replacement=selectTarget(await bounded(()=>discoverTargets(cdp,filter),'fresh worker reacquisition'),{url:input.url,type:'worker'});
  if(replacement.targetId===stopped.targetId)throw Error('Worker target identity was not replaced');
  const response=await bounded(async()=>{const value=await cdp.send('Target.attachToTarget',{targetId:replacement.targetId,flatten:false});attached=value.sessionId;if(disposed&&attached)await cdp.send('Target.detachFromTarget',{sessionId:attached});return value;},'replacement worker attachment');
  if(!attached)throw Error('Replacement worker attachment returned no session identity');
  return {stopped,replacement,sessionId:attached,dispose,limits:['Forced stop is not natural idle suspension','Target discovery and replacement debugger attachment can affect worker lifetime','Only assigned dedicated worker; no service-worker stop or automatic wake/retry','Caller owns replacement worker; adapter owns temporary CDP attachment']};
 }catch(error){await dispose();throw error;}
}
