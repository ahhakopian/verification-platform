import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {reconcile,type Reconciliation} from './evidence/reconcile.js';
import type {Evidence,ClaimRecord,Result} from '../src/contracts/index.js';
import {sourceDigest} from '../src/validation/result.js';
import {validateCoverage} from '../src/compilation/coverage.js';
import {validateSchema} from '../src/validation/schema.js';
import {sha256} from '../src/resources/resolve.js';
export async function invokePlaywright(input:Omit<Reconciliation,'records'|'evidence'|'runner'> & {runnerEntry:string;config:string;resultPath:string;cwd:string}){
 const errors=validateCoverage(input.plan,input.assignment,input.manifest);
 if(errors.length||input.identity.generatedSourceDigest!==sourceDigest(input.cwd,input.manifest.entries.filter(e=>!e.blocker).map(e=>e.source!)))throw Error('Current bundle identity/coverage mismatch: '+errors.join('; '));
 if(input.manifest.entries.every(entry=>entry.blocker)){
  const result=reconcile({...input,evidence:[],records:[],runner:{exitCode:null,status:'not-run'}});writeFileSync(input.resultPath,JSON.stringify(result,null,2)+'\n');return {result,runnerExitCode:null,acceptanceExitCode:1};
 }
 if(input.identity.fixtureDigest!==sha256(readFileSync(resolve(input.cwd,input.assignment.fixtureEntry))))throw Error('Current fixture bytes mismatch');
 for(const provider of input.identity.providerSources)if(provider.entryDigest!==sha256(readFileSync(resolve(input.cwd,provider.entry)))||provider.declarationsDigest!==sha256(readFileSync(resolve(input.cwd,provider.declarations))))throw Error('Current provider bytes mismatch: '+provider.id);
 const started=Date.now();
 const child=spawn(process.execPath,[input.runnerEntry,'test','--config',input.config,'--workers=1','--retries=0'],{cwd:input.cwd,stdio:'inherit'});
 const exitCode=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 // A successful reporter already checked real standard annotations/mapping.
 // Do not replace its rejected records with an unchecked directory scan.
 try {const report:Result=JSON.parse(readFileSync(input.resultPath,'utf8'));if(!validateSchema('result',report).length&&JSON.stringify(report.identity)===JSON.stringify(input.identity)){
   const {statSync}=await import('node:fs');if(statSync(input.resultPath).mtimeMs>=started){report.runner.exitCode=exitCode;writeFileSync(input.resultPath,JSON.stringify(report,null,2)+'\n');return {result:report,runnerExitCode:exitCode,acceptanceExitCode:report.verdict==='PASS'&&exitCode===0?0:1};}
 }}catch{}
 const evidence:Evidence[]=[],records:ClaimRecord[]=[];
 // Playwright copies attached records into attachments/. Collect canonical
 // recorder files once; copied attachments must not duplicate evidence IDs.
 const collect=(dir:string)=>{for(const e of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory()){if(e.name!=='attachments')collect(path);}else if(e.name.endsWith('.json'))try{const value=JSON.parse(readFileSync(path,'utf8'));if(e.name.startsWith('claim-'))records.push(value);else if(e.name.startsWith('evidence-'))evidence.push(value);}catch{}}};
 try{collect(input.outputRoot);}catch{}
 // Crash finalization preserves contradictions/attempt facts, but without a
 // current reporter's actual annotation/source joins it cannot accept PASS.
 const result=reconcile({...input,evidence,records,runner:{exitCode,status:'incomplete-collection'},limitations:[...(input.limitations??[]),'No current reporter finalization; standard runner mapping unproved']});
 writeFileSync(input.resultPath,JSON.stringify(result,null,2)+'\n');
 return {result,runnerExitCode:exitCode,acceptanceExitCode:result.verdict==='PASS'?0:1};
}
