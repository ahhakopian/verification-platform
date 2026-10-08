import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {boundedProcess} from './process.js';
import type {OwnedSession} from '../../../src/contracts/index.js';
export interface HostConfig {runtimeConfig:string;powershell:string;launch:boolean;readinessMs:number;disposalMs:number;signal?:AbortSignal}
export class RuntimeAcquisitionError extends Error {
 readonly phase='readiness';readonly category='prerequisite';
 constructor(cause:unknown,readonly raw:{stdout:string;stderr:string;exitCode:number|null},readonly cleanupErrors:string[]){super(cause instanceof Error?cause.message:String(cause),{cause});}
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
