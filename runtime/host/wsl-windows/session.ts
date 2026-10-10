import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {boundedProcess} from './process.js';
import type {OwnedSession} from '../../../src/contracts/index.js';
export interface HostConfig {runtimeConfig:string;powershell:string;launch:boolean;readinessMs:number;disposalMs:number;signal?:AbortSignal}
export class RuntimeAcquisitionError extends Error {
 readonly phase='readiness';readonly category='prerequisite';
 constructor(cause:unknown,readonly raw:{stdout:string;stderr:string;exitCode:number|null},readonly cleanupErrors:string[]){super(cause instanceof Error?cause.message:String(cause),{cause});}
}
export interface ClosedBrowserBaselineResult {
 status:'READY'|'BLOCKED';baseline:'CLOSED';resetAttempted:boolean;reason:string;
 observations:Record<string,unknown>[];cleanupErrors:string[];
}
// Explicit caller lifecycle action only. Obtain host/HITL permission before calling.
// This path never launches Chrome and does not participate in BrowserPreflight.
export async function prepareClosedBrowserBaseline(config:HostConfig,closeAuthorized:boolean):Promise<ClosedBrowserBaselineResult>{
 const result:ClosedBrowserBaselineResult={status:'BLOCKED',baseline:'CLOSED',resetAttempted:false,reason:'Closed baseline not established',observations:[],cleanupErrors:[]};
 const deadline=Date.now()+config.readinessMs;
 let session:OwnedSession|undefined,browser:import('@playwright/test').Browser|undefined;
 const remaining=()=>{if(config.signal?.aborted)throw Error('Closed baseline cancelled');const ms=deadline-Date.now();if(ms<=0)throw Error('Closed baseline deadline exceeded');return ms;};
 const wait=async<T>(operation:()=>Promise<T>,ms:number,signal?:AbortSignal)=>{
  let timer:ReturnType<typeof setTimeout>|undefined,cancel:(()=>void)|undefined;
  try{return await Promise.race([operation(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Closed baseline operation deadline exceeded')),ms);cancel=()=>reject(Error('Closed baseline cancelled'));signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();})]);}
  finally{if(timer)clearTimeout(timer);if(cancel)signal?.removeEventListener('abort',cancel);}
 };
 const inspect=async()=>{
  const script=fileURLToPath(new URL('./browser-session.py',import.meta.url));
  const query=await boundedProcess('python3',['-c','import importlib.util,json,sys; spec=importlib.util.spec_from_file_location("browser_session",sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); w=module.Windows(sys.argv[2],sys.argv[3]); print(json.dumps(w.closed_baseline()))',script,config.runtimeConfig,config.powershell],remaining(),false,config.signal);
  if(query.exitCode!==0||query.timedOut)throw Error('Closed baseline inspection failed: '+query.stdout+' '+query.stderr);
  const record=JSON.parse(query.stdout);
  if(record.status!=='ok'||!['STOPPED','RUNNING'].includes(record.state))throw Error('Invalid closed baseline observation');
  if(record.state==='STOPPED'&&(record.profileProcessCount!==0||record.listenerCount!==0))throw Error('Closed baseline absence is unproved');
  result.observations.push(record);return record;
 };
 try{
  const initial=await inspect();
  if(initial.state==='RUNNING'){
   if(!closeAuthorized)throw Error('Closing the configured browser is not authorized');
   session=await acquireSession({...config,launch:false,readinessMs:remaining()});
   const provenance=session.provenance as Record<string,unknown>;
   for(const key of ['binary','profile','version','process_id','started_at','webSocketDebuggerUrl'])if(provenance[key]!==initial[key])throw Error('Closed baseline browser identity changed before reset');
   const {chromium}=await import('@playwright/test');
   browser=await chromium.connectOverCDP(session.endpoint,{timeout:remaining()});
   await wait(()=>session!.revalidate(),remaining(),config.signal);
   const cdp=await wait(()=>browser!.newBrowserCDPSession(),remaining(),config.signal);
   result.resetAttempted=true;
   await wait(()=>cdp.send('Browser.close'),remaining(),config.signal);
   // No kill fallback or second close. Verify actual absence rather than error text.
   while((await inspect()).state!=='STOPPED')await wait(()=>new Promise<void>(resolve=>setTimeout(resolve,50)),remaining(),config.signal);
  }
  result.status='READY';result.reason=initial.state==='STOPPED'?'Configured browser already stopped':'Configured browser explicitly closed and stopped state verified';
 }catch(error){result.reason=error instanceof Error?error.message:String(error);}
 finally{
  if(browser)try{await wait(()=>browser!.close(),config.disposalMs);}catch(error){result.cleanupErrors.push(String(error));}
  if(session)try{await session.dispose();}catch(error){result.cleanupErrors.push(String(error));}
  if(result.cleanupErrors.length){result.status='BLOCKED';result.reason+='; temporary connection cleanup failed';}
 }
 return result;
}
export async function acquireSession(config:HostConfig):Promise<OwnedSession>{
 if(config.signal?.aborted)throw Error('Runtime acquisition cancelled before attempt');
 const script=fileURLToPath(new URL('./browser-session.py',import.meta.url));
 const child=spawn('python3',[script,'--config',config.runtimeConfig,'--powershell',config.powershell,'--readiness-ms',String(config.readinessMs),...(config.launch?['--launch']:[])],{stdio:'pipe'});
 let stdout='',stderr='',exited=false,exitCode:number|null=null;child.stderr.on('data',d=>stderr+=d);
 const exit=new Promise<void>(resolve=>child.once('close',code=>{exited=true;exitCode=code;resolve();}));
 let disposed:Promise<void>|undefined;
 const dispose=()=>disposed??=new Promise<void>((resolve,reject)=>{if(exited){resolve();return;}child.kill('SIGINT');const timer=setTimeout(()=>{child.kill('SIGKILL');},config.disposalMs);const hard=setTimeout(()=>reject(Error('Owned relay disposal deadline exceeded')),config.disposalMs+2000);exit.then(()=>{clearTimeout(timer);clearTimeout(hard);resolve();});});
 const cleanupErrors:string[]=[];const abort=()=>{void dispose().catch(error=>cleanupErrors.push(String(error)));};config.signal?.addEventListener('abort',abort,{once:true});
 exit.then(()=>config.signal?.removeEventListener('abort',abort));
 try {
  const record:any=await new Promise((resolve,reject)=>{
   let settled=false;
   const cleanup=()=>{clearTimeout(timer);config.signal?.removeEventListener('abort',cancelled);child.stdout.removeListener('data',data);child.removeListener('error',failed);child.removeListener('close',closed);};
   const fail=(error:unknown)=>{if(settled)return;settled=true;cleanup();reject(error);};
   const timer=setTimeout(()=>fail(Error('Runtime readiness deadline exceeded: '+stderr)),config.readinessMs);
   const cancelled=()=>fail(Error('Runtime readiness cancelled: '+stdout+' '+stderr));
   const data=(d:Buffer)=>{stdout+=d;const newline=stdout.indexOf('\n');if(newline>=0&&!settled){try{const record=JSON.parse(stdout.slice(0,newline));settled=true;cleanup();resolve(record);}catch(error){fail(error);}}};
   const failed=(error:Error)=>fail(error);const closed=()=>fail(Error('Runtime bridge exited before readiness: '+stdout+' '+stderr));
   config.signal?.addEventListener('abort',cancelled,{once:true});
   child.stdout.on('data',data);child.once('error',failed);child.once('close',closed);
   if(config.signal?.aborted)cancelled();
  });
  if(record.status!=='ok'||typeof record.cdp_endpoint!=='string'||!record.process_id||!record.started_at||!record.webSocketDebuggerUrl)throw Error('Invalid runtime readiness observation: '+JSON.stringify(record));
  return {endpoint:record.cdp_endpoint,provenance:record,dispose,async revalidate(){
    if(exited)throw Error('Owned relay lost');
    const query=await boundedProcess('python3',['-c','import importlib.util,json,sys; spec=importlib.util.spec_from_file_location("browser_session",sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); w=module.Windows(sys.argv[2],sys.argv[3]); print(json.dumps(w.snapshot()))',script,config.runtimeConfig,config.powershell],config.readinessMs,false,config.signal);
    if(query.exitCode!==0||query.timedOut)throw Error('Runtime revalidation failed: '+query.stderr);
    const current=JSON.parse(query.stdout);
    for(const key of ['process_id','started_at','webSocketDebuggerUrl'])if(current[key]!==record[key])throw Error('Runtime incarnation changed');
  }};
 }catch(error){config.signal?.removeEventListener('abort',abort);try{await dispose();}catch(cleanup){cleanupErrors.push(String(cleanup));}throw new RuntimeAcquisitionError(error,{stdout,stderr,exitCode},cleanupErrors);}
}
