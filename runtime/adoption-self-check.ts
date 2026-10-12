import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Browser} from '@playwright/test';
import type {Binding,ExecutionIdentity} from '../src/contracts/index.js';
import {resolveResources,sha256,type ResolutionConfig} from '../src/resources/resolve.js';
import {projectPreflight,PreflightRecorder,type BrowserEnvironment} from './preflight.js';
import {collectPreflight} from './evidence/readiness.js';

export async function installedHookSelfCheck(binding:Binding,resolution:ResolutionConfig,outputRoot:string,executionId=randomUUID(),attempt=1){
 const resolved=resolveResources(binding,{...resolution,mode:'execution'});
 const resource=resolved.resources.get('dist/runtime/assets/adoption-hook-canary.mjs');
 if(!resource)throw Error('Indexed installed hook canary required');
 const root=resolve(outputRoot);
 if(existsSync(root))throw Error('Self-check attempt already exists; inspect evidence, never relaunch');
 if(!Number.isInteger(attempt)||attempt<1)throw Error('Positive explicit self-check attempt required');
 mkdirSync(join(root,'scratch'),{recursive:true});mkdirSync(join(root,'records'),{recursive:true});
 const bytes=readFileSync(resource.path);writeFileSync(join(root,'scratch','canary.mjs'),bytes,{flag:'wx'});
 const identity:ExecutionIdentity={executionId,attempt,planDigest:sha256('platform-self-check'),bindingDigest:resolved.bindingDigest,assignmentDigest:sha256('synthetic-self-check'),generatedSourceDigest:sha256(bytes),fixtureDigest:sha256(bytes),providerSources:[],providers:[{id:'platform-self-check',version:binding.tag}],provenance:{runtime:'synthetic',build:binding.sourceCommit,tools:{node:process.version}}};
 const recorder=new PreflightRecorder(join(root,'records'),identity,'synthetic-hook-mechanism',0);
 const provenance={binary:'synthetic',profile:'synthetic',version:'synthetic',process_id:1,started_at:'synthetic',webSocketDebuggerUrl:'ws://synthetic.invalid'};
 const environment:BrowserEnvironment={browser:{isConnected:()=>true} as Browser,provenance,session:{endpoint:'synthetic',provenance,revalidate:async()=>{},dispose:async()=>{}}};
 const input={purpose:'platform-self-check',nonce:randomUUID()};
 await recorder.append({stage:'browser',status:'PASS',reason:'Synthetic self-check fixture; no live browser acquired',observations:{synthetic:true},evidence:[],cleanupErrors:[]});
 await projectPreflight(environment,recorder,join(root,'scratch'),{contractVersion:1,entry:'canary.mjs',sha256:resource.resource.sha256,deadlineMs:5000,input});
 const collected=collectPreflight(join(root,'records'),identity),project=collected.records[1],observations=project?.observations as any;
 if(collected.errors.length||collected.records.length!==2||project.status!=='PASS'||observations.hook?.sha256!==sha256(bytes)||observations.hook?.inputDigest!==sha256(JSON.stringify(input))||project.evidence.length!==1)throw Error('Installed hook self-check did not produce valid evidence');
 const facts=JSON.parse(readFileSync(project.evidence[0].path,'utf8'));
 if(facts.purpose!=='platform-self-check'||facts.synthetic!==true||facts.executionId!==executionId||facts.environmentId!==recorder.environmentId||JSON.stringify(facts.input)!==JSON.stringify(input))throw Error('Installed canary context/evidence mismatch');
 const report={schemaVersion:1,purpose:'platform-self-check',synthetic:true,identity,outcome:'PASS',indexDigest:resolved.indexDigest,evidence:collected.paths};
 writeFileSync(join(root,'self-check.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return report;
}
