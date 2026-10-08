import {fileURLToPath} from 'node:url';
import {boundedProcess} from './process.js';
export type NativeCriteria=Partial<Record<'name'|'type'|'class'|'id'|'handle'|'processId',string|number>>;
export interface NativeOperationInput {operation:'windows'|'tree'|'inspect'|'invoke'|'expand';powershell:string;runtimeConfig:string;window?:NativeCriteria;element?:NativeCriteria;deadlineMs:number;signal?:AbortSignal}
export type NativeOperationObservation=Awaited<ReturnType<typeof nativeOperation>>;
export async function nativeOperation(input:NativeOperationInput){
 const script=fileURLToPath(new URL('./native-ui.ps1',import.meta.url));
 const deadline=performance.now()+input.deadlineMs;const remaining=()=>Math.max(0,deadline-performance.now());
 const config=await boundedProcess('wslpath',['-w',input.runtimeConfig],remaining(),false,input.signal);
 const converted=await boundedProcess('wslpath',['-w',script],remaining(),false,input.signal);
 if(config.exitCode!==0||converted.exitCode!==0) return {phase:'readiness',category:'prerequisite',attempted:false,raw:{config,converted}};
 const action=input.operation==='invoke'||input.operation==='expand';
 const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',converted.stdout.trim(),'-ConfigPath',config.stdout.trim(),'-Operation',input.operation];
 if(input.window)args.push('-WindowCriteria',JSON.stringify(input.window));if(input.element)args.push('-ElementCriteria',JSON.stringify(input.element));
 const raw=await boundedProcess(input.powershell,args,remaining(),action,input.signal);
 let observation:unknown;try{observation=JSON.parse(raw.stdout.replace(/^\uFEFF/,''));}catch{observation=undefined;}
 const rejected=Boolean(observation&&typeof observation==='object'&&'status' in observation&&observation.status==='error');
 const structured=observation as {phase?:string;attempted?:boolean}|undefined;
 const attempted=typeof structured?.attempted==='boolean'?structured.attempted:raw.possiblyActed;
 return {phase:structured?.phase??(action?'action':'observation'),category:raw.timedOut?'timeout':raw.exitCode!==0||rejected?'infrastructure':'observation',attempted,uncertain:attempted&&(raw.timedOut||raw.exitCode!==0||!observation||rejected),observation,raw};
}
