import {spawn} from 'node:child_process';
export interface DeadlineEvidence {role:'platform-semantic'|'watchdog';source:string;deadlineMs:number;elapsedMs:number;trigger?:'deadline'|'cancellation'}
export interface ProcessObservation {stdout:string;stderr:string;exitCode:number|null;timedOut:boolean;possiblyActed:boolean;deadline:DeadlineEvidence}
export async function boundedProcess(command:string,args:string[],deadlineMs:number,possiblyActed=false,signal?:AbortSignal,cwd?:string,provenance:Pick<DeadlineEvidence,'role'|'source'>={role:'watchdog',source:'boundedProcess caller'}):Promise<ProcessObservation>{
 const started=performance.now();let trigger:DeadlineEvidence['trigger'];
 const evidence=():DeadlineEvidence=>({...provenance,deadlineMs,elapsedMs:performance.now()-started,...(trigger?{trigger}:{}),...(trigger==='cancellation'?{role:'watchdog' as const,source:'AbortSignal'}:{})});
 if(signal?.aborted||deadlineMs<=0){trigger=signal?.aborted?'cancellation':'deadline';return {stdout:'',stderr:'Cancelled/deadline expired before subprocess start',exitCode:null,timedOut:true,possiblyActed:false,deadline:evidence()};}
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:'pipe',cwd});let stdout='',stderr='',timedOut=false,settled=false;let hard:ReturnType<typeof setTimeout>|undefined;
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  const finish=(exitCode:number|null)=>{if(settled)return;settled=true;clear();resolve({stdout,stderr,exitCode,timedOut,possiblyActed,deadline:evidence()});};
  const cancel=()=>{if(timedOut||settled)return;trigger=signal?.aborted?'cancellation':'deadline';timedOut=true;clearTimeout(timer);child.kill('SIGTERM');hard=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();finish(child.exitCode);},2000);};
  const timer=setTimeout(cancel,deadlineMs);
  signal?.addEventListener('abort',cancel,{once:true});
  const clear=()=>{clearTimeout(timer);if(hard)clearTimeout(hard);signal?.removeEventListener('abort',cancel);};
  child.once('error',e=>{if(settled)return;settled=true;clear();reject(e);});child.once('close',finish);
  if(signal?.aborted)cancel();
 });
}
