import type {Browser,CDPSession} from '@playwright/test';
import {browserCDP,discoverTargets,type TargetFilter,type Target} from './extension-action.cjs';
export interface TargetObservation {sequence:number;kind:'initial'|'created'|'changed'|'destroyed';targetId:string;target?:Target}
export type TargetObserver=Awaited<ReturnType<typeof observeTargets>>;
export async function observeTargets(browser:Browser,filter:TargetFilter[],limit:number){
 if(!Number.isInteger(limit)||limit<1)throw Error('Explicit positive observation limit required');
 const cdp=await browserCDP(browser),observations:TargetObservation[]=[],loss:string[]=[];
 const start=performance.now();let sequence=0,ready=false,disposed=false;const duringDiscovery:TargetObservation[]=[];
 const append=(value:Omit<TargetObservation,'sequence'>)=>{const record={sequence:sequence++,...value};const destination=ready?observations:duringDiscovery;if(destination.length>=limit){if(!loss.includes('overflow'))loss.push('overflow');return;}destination.push(record);};
 const created=(event:any)=>append({kind:'created',targetId:event.targetInfo.targetId,target:event.targetInfo});
 const changed=(event:any)=>append({kind:'changed',targetId:event.targetInfo.targetId,target:event.targetInfo});
 const destroyed=(event:any)=>append({kind:'destroyed',targetId:event.targetId});
 const disconnected=()=>loss.push('browser-disconnected');
 const closed=()=>{if(!disposed)loss.push('target-session-lost');};
 cdp.on('close',closed);cdp.on('Target.targetCreated',created);cdp.on('Target.targetInfoChanged',changed);cdp.on('Target.targetDestroyed',destroyed);browser.on('disconnected',disconnected);
 const dispose=async()=>{if(disposed)return;disposed=true;cdp.removeListener('close',closed);cdp.removeListener('Target.targetCreated',created);cdp.removeListener('Target.targetInfoChanged',changed);cdp.removeListener('Target.targetDestroyed',destroyed);browser.removeListener('disconnected',disconnected);await cdp.detach();};
 try {
  await cdp.send('Target.setDiscoverTargets',{discover:true,filter});
  const initial=await discoverTargets(cdp,filter);
  if(loss.some(reason=>reason!=='overflow'))throw Error('Target source lost during discovery readiness: '+loss.join(', '));
  const changedIds=new Set(duringDiscovery.map(r=>r.targetId));ready=true;
  for(const target of initial)if(!changedIds.has(target.targetId))append({kind:'initial',targetId:target.targetId,target});
  for(const r of duringDiscovery){if(observations.length<limit)observations.push(r);else if(!loss.includes('overflow'))loss.push('overflow');}
  observations.sort((a,b)=>a.sequence-b.sequence);
  const readyAt=performance.now();return {ready:true as const,readyAt,observations,loss,dispose,async finish(){const end=performance.now();await dispose();return {start,readyAt,end,complete:loss.length===0,loss:[...loss],observations:[...observations]};},limits:['Target subscription effects disclosed; snapshot and event namespaces are CDP only','No idle suspension or application callback provenance established']};
 }catch(error){try{await dispose();}catch(cleanup){loss.push('cleanup: '+String(cleanup));}throw error;}
}
