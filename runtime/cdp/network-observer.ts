import type {CDPSession} from '@playwright/test';
export interface NetworkScope {sourceId:string;sessionId:string;sessionIdentityNamespace?:'provider.session'|'cdp.session';targetId:string;type:'page'|'frame'|'worker';identityNamespace:'cdp.target';limit:number;lossSignal:AbortSignal}
export type NetworkObserver=Awaited<ReturnType<typeof observeNetwork>>;
export async function observeNetwork(cdp:CDPSession,scope:NetworkScope){
 if(!scope.sourceId||!scope.sessionId||!scope.targetId||(!Number.isInteger(scope.limit)||scope.limit<1)||scope.lossSignal.aborted)throw Error('Current exact scoped source/lifetime required');
 const observations:{sequence:number;sourceId:string;sessionId:string;requestId:string;method:string;raw:unknown}[]=[],loss:string[]=[];
 let sequence=0,finished=false;const start=performance.now();
 const methods=['Network.requestWillBeSent','Network.responseReceived','Network.loadingFinished','Network.loadingFailed'] as const;
 const listeners=new Map<typeof methods[number],(event:any)=>void>();
 const lost=()=>{if(!loss.includes('source-session-lost'))loss.push('source-session-lost');};cdp.on('close',lost);scope.lossSignal.addEventListener('abort',lost,{once:true});
 for(const method of methods){
  const listener=(raw:any)=>{if(finished)return;if(observations.length>=scope.limit){if(!loss.includes('overflow'))loss.push('overflow');return;}observations.push({sequence:sequence++,sourceId:scope.sourceId,sessionId:scope.sessionId,requestId:raw.requestId,method,raw});};listeners.set(method,listener);cdp.on(method,listener);
 }
 const dispose=()=>{if(finished)return;finished=true;for(const [method,listener]of listeners)cdp.removeListener(method,listener);scope.lossSignal.removeEventListener('abort',lost);cdp.removeListener('close',lost);};
 try {await cdp.send('Network.enable');if(scope.lossSignal.aborted||loss.length){dispose();throw Error('Network source lost during subscription readiness');}}catch(error){dispose();throw error;}
 const readyAt=performance.now();return {ready:true as const,readyAt,scope,observations,loss,finish(){const end=performance.now();dispose();return {start,readyAt,end,scope:{sourceId:scope.sourceId,sessionId:scope.sessionId,sessionIdentityNamespace:scope.sessionIdentityNamespace??'provider.session',targetId:scope.targetId,type:scope.type,identityNamespace:scope.identityNamespace},complete:loss.length===0,loss:[...loss],observations:[...observations]};},dispose,limits:['Network.enable remains active on borrowed session; caller disposes that session; Only this explicit CDP source/session; no extension attribution inferred from URL','Additional page/frame/worker sources and permission changes need separate coverage','Session key is caller-declared provider.session unless an observed cdp.session mapping is supplied; CDP frame/loader identities are not extension document identities']};
}
