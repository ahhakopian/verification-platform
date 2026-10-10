import {fileURLToPath} from 'node:url';
import {boundedProcess} from './process.js';
export type NativeCriteria=Partial<Record<'name'|'type'|'class'|'id'|'handle'|'processId',string|number>>;
export interface NativeOperationInput {operation:'windows'|'tree'|'inspect'|'invoke'|'expand'|'menu-bind'|'menu-focus'|'menu-tree'|'menu-next'|'menu-invoke'|'menu-expand';powershell:string;runtimeConfig:string;window?:NativeCriteria;element?:NativeCriteria;deadlineMs:number;signal?:AbortSignal;menu?:NativeMenuRequest}
export interface NativeMenuAssociation {parentRuntimeId:number[];parentLabel:string;rootRuntimeId:number[];boundWindowHandle:number;before:unknown[];beforeAt:string;expandedAt:string;expandDecision:string;selectedRuntimeId?:number[];selectedHandle?:number;[key:string]:unknown}
export interface NativeMenuRequest {targetId:string;nonce:string;requireForeground?:boolean;foregroundFree?:boolean;association?:NativeMenuAssociation;windowRuntimeId?:number[];rootRuntimeId?:number[];elementRuntimeId?:number[];path?:string[];ancestors?:Array<{rootRuntimeId:number[];elementRuntimeId:number[];label:string;association?:NativeMenuAssociation}>;runtime?:{process_id:number;started_at:string;webSocketDebuggerUrl:string}}
export type NativeOperationObservation=Awaited<ReturnType<typeof nativeOperation>>;
export async function nativeOperation(input:NativeOperationInput){
 const script=fileURLToPath(new URL('./native-ui.ps1',import.meta.url));
 const deadline=performance.now()+input.deadlineMs;const remaining=()=>Math.max(0,deadline-performance.now());
 const config=await boundedProcess('wslpath',['-w',input.runtimeConfig],remaining(),false,input.signal);
 const converted=await boundedProcess('wslpath',['-w',script],remaining(),false,input.signal);
 if(config.exitCode!==0||converted.exitCode!==0) return {phase:'readiness',category:'prerequisite',attempted:false,raw:{config,converted}};
 const action=['invoke','expand','menu-focus','menu-invoke','menu-expand'].includes(input.operation);
 const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',converted.stdout.trim(),'-ConfigPath',config.stdout.trim(),'-Operation',input.operation];
 if(input.window)args.push('-WindowCriteria',JSON.stringify(input.window));if(input.element)args.push('-ElementCriteria',JSON.stringify(input.element));
 if(input.menu)args.push('-MenuRequest',JSON.stringify(input.menu));
 const raw=await boundedProcess(input.powershell,args,remaining(),action,input.signal);
 let observation:unknown;try{observation=JSON.parse(raw.stdout.replace(/^\uFEFF/,''));}catch{observation=undefined;}
 const rejected=Boolean(observation&&typeof observation==='object'&&'status' in observation&&observation.status==='error');
 const structured=observation as {phase?:string;attempted?:boolean}|undefined;
 const attempted=typeof structured?.attempted==='boolean'?structured.attempted:raw.possiblyActed;
 return {phase:structured?.phase??(action?'action':'observation'),category:raw.timedOut?'timeout':raw.exitCode!==0||rejected?'infrastructure':'observation',attempted,uncertain:attempted&&(raw.timedOut||raw.exitCode!==0||!observation||rejected),observation,raw};
}
