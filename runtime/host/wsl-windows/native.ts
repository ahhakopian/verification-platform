import {fileURLToPath} from 'node:url';
import {boundedProcess, type DeadlineEvidence} from './process.js';
import {descriptors} from '../../catalog.js';
const nativeCapabilities=descriptors.find(provider=>provider.id==='generic:native')!.capabilities;
export const nativeMenuDeadlineMs=nativeCapabilities.find(capability=>capability.id==='native:menu')!.deadlineMs;
const nativeSemanticDeadlineMs=nativeCapabilities.find(capability=>capability.id==='native:semantic')!.deadlineMs;
export type NativeCriteria=Partial<Record<'name'|'type'|'class'|'id'|'handle'|'processId',string|number>>;
export interface NativeOperationInput {operation:'windows'|'tree'|'inspect'|'invoke'|'expand'|'menu-bind'|'menu-focus'|'menu-tree'|'menu-next'|'menu-invoke'|'menu-expand';powershell:string;runtimeConfig:string;window?:NativeCriteria;element?:NativeCriteria;/** External execution watchdog, never a semantic deadline. */ deadlineMs:number;signal?:AbortSignal;menu?:NativeMenuRequest}
export interface NativeMenuAssociation {parentRuntimeId:number[];parentLabel:string;rootRuntimeId:number[];boundWindowHandle:number;before:unknown[];beforeAt:string;expandedAt:string;expandDecision:string;selectedRuntimeId?:number[];selectedHandle?:number;[key:string]:unknown}
export interface NativeMenuRequest {targetId:string;nonce:string;requireForeground?:boolean;foregroundFree?:boolean;association?:NativeMenuAssociation;windowRuntimeId?:number[];rootRuntimeId?:number[];elementRuntimeId?:number[];path?:string[];ancestors?:Array<{rootRuntimeId:number[];elementRuntimeId:number[];label:string;association?:NativeMenuAssociation}>;runtime?:{process_id:number;started_at:string;webSocketDebuggerUrl:string}}
export type NativeOperationObservation=Awaited<ReturnType<typeof nativeOperation>>;
export async function nativeOperation(input:NativeOperationInput){
 return executeNative(input,nativeSemanticDeadlineMs,'contracts/generic-descriptors.json#native:semantic');
}
/** Internal menu bridge: the remaining budget is exclusively the catalog-defined native:menu deadline. */
export async function nativeMenuOperation(input:NativeOperationInput,semanticRemainingMs:number){
 return executeNative(input,semanticRemainingMs,'contracts/generic-descriptors.json#native:menu');
}
async function executeNative(input:NativeOperationInput,semanticMs:number,semanticSource:string){
 const script=fileURLToPath(new URL('./native-ui.ps1',import.meta.url));
 const started=performance.now(),semanticDeadline=started+semanticMs,watchdogDeadline=started+input.deadlineMs;
 const run=(command:string,args:string[],action=false)=>{
  const watchdog=watchdogDeadline<semanticDeadline;
  return boundedProcess(command,args,Math.max(0,Math.min(semanticDeadline,watchdogDeadline)-performance.now()),action,input.signal,undefined,
   {role:watchdog?'watchdog':'platform-semantic',source:watchdog?'NativeOperationInput.deadlineMs':semanticSource});
 };
 const config=await run('wslpath',['-w',input.runtimeConfig]);
 const converted=config.timedOut?undefined:await run('wslpath',['-w',script]);
 const stopped=config.timedOut?config:converted?.timedOut?converted:undefined;
 const deadlineEvidence=(raw:{deadline:DeadlineEvidence})=>({...raw.deadline,deadlineMs:raw.deadline.role==='platform-semantic'?semanticMs:input.deadlineMs,elapsedMs:performance.now()-started});
 if(stopped)return {operation:input.operation,phase:stopped.deadline.role==='watchdog'?'watchdog':'readiness',category:stopped.deadline.role==='watchdog'?'watchdog':'timeout',attempted:false,uncertain:false,deadline:deadlineEvidence(stopped),raw:{config,converted}};
 if(config.exitCode!==0||converted?.exitCode!==0)return {operation:input.operation,phase:'readiness',category:'prerequisite',attempted:false,raw:{config,converted}};
 const action=['invoke','expand','menu-focus','menu-invoke','menu-expand'].includes(input.operation);
 const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',converted.stdout.trim(),'-ConfigPath',config.stdout.trim(),'-Operation',input.operation];
 if(input.window)args.push('-WindowCriteria',JSON.stringify(input.window));if(input.element)args.push('-ElementCriteria',JSON.stringify(input.element));
 if(input.menu)args.push('-MenuRequest',JSON.stringify(input.menu));
 const raw=await run(input.powershell,args,action);
 let observation:unknown;try{observation=JSON.parse(raw.stdout.replace(/^\uFEFF/,''));}catch{observation=undefined;}
 const rejected=Boolean(observation&&typeof observation==='object'&&'status' in observation&&observation.status==='error');
 const structured=observation as {phase?:string;attempted?:boolean}|undefined;
 const attempted=typeof structured?.attempted==='boolean'?structured.attempted:raw.possiblyActed;
 const watchdog=raw.timedOut&&raw.deadline.role==='watchdog';
 return {operation:input.operation,phase:watchdog?'watchdog':structured?.phase??(action?'action':'observation'),category:watchdog?'watchdog':raw.timedOut?'timeout':raw.exitCode!==0||rejected?'infrastructure':'observation',attempted,uncertain:attempted&&(raw.timedOut||raw.exitCode!==0||!observation||rejected),observation,deadline:deadlineEvidence(raw),raw};
}
