import {test as base,expect,type Browser,type Page,type TestInfo} from '@playwright/test';
import type {OwnedSession,ExecutionIdentity} from '../src/contracts/index.js';
import {type HostConfig} from './host/wsl-windows/session.js';
import {EvidenceRecorder} from './evidence/records.js';
import {recordReadinessFailure,PreflightRecorder} from './evidence/readiness.js';
import {browserPreflight,projectPreflight,targetPreflight,environmentReady as completeEnvironmentReady,type PreflightOptions,type BrowserEnvironment} from './preflight.js';
import {sha256} from '../src/resources/resolve.js';
import {isAbsolute} from 'node:path';
import {validateSchema} from '../src/validation/schema.js';
export {expect};
export interface RuntimeOptions {hostConfig:HostConfig;pageUrl:string;executionIdentity:ExecutionIdentity;preflight:PreflightOptions}
export async function assignedPageReady(browser:Browser,pageUrl:string,identity:ExecutionIdentity,testInfo:TestInfo):Promise<Page>{
 try{if(!pageUrl)throw Error('Explicit unique page URL required');const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url()===pageUrl);if(pages.length!==1)throw Error('Assigned borrowed page must match exactly once');return pages[0];}
 catch(error){const keys=testInfo.annotations.filter(a=>a.type==='testKey').map(a=>a.description);if(identity&&keys.length===1&&keys[0]){const detail=error instanceof Error?error.message:String(error);try{await testInfo.attach('readiness-selection',{body:Buffer.from(JSON.stringify({schemaVersion:1,identity,testKey:keys[0],phase:'readiness',attempted:false,category:'prerequisite',detail})),contentType:'application/json'});}catch(collectionError){process.stderr.write('Readiness evidence collection error: '+String(collectionError)+'\n');}}throw error;}
}
export const test=base.extend<{assignedPage:Page;evidence:EvidenceRecorder;environmentReady:void},RuntimeOptions&{assignedBrowser:Browser;hostSession:OwnedSession;browserEnvironment:BrowserEnvironment;preflightRecorder:PreflightRecorder}>({
 hostConfig:[undefined as unknown as HostConfig,{option:true,scope:'worker'}],
 pageUrl:['',{option:true,scope:'worker'}],executionIdentity:[undefined as unknown as ExecutionIdentity,{option:true,scope:'worker'}],
 preflight:[undefined as unknown as PreflightOptions,{option:true,scope:'worker'}],
 preflightRecorder:[async({preflight,executionIdentity,hostConfig,pageUrl},use,workerInfo)=>{
  try{
   if(!preflight||!executionIdentity)throw Error('Explicit preflight configuration and execution identity required');
   if(validateSchema('assignment',preflight.assignment).length||validateSchema('browser-verification-plan',JSON.parse(preflight.planBytes)).length||sha256(preflight.planBytes)!==executionIdentity.planDigest||!isAbsolute(preflight.projectRoot)||validateSchema('coverage-manifest',preflight.manifest).length||JSON.stringify(preflight.manifest.identity)!==JSON.stringify(executionIdentity)||sha256(JSON.stringify(preflight.assignment))!==executionIdentity.assignmentDigest)throw Error('Current preflight assignment/plan/manifest required');
   const environments=preflight.assignment.environments.filter(e=>e.id===preflight.environmentId);
   if(environments.length!==1||environments[0].runtimeConfig!==hostConfig?.runtimeConfig||environments[0].powershell!==hostConfig.powershell||environments[0].launch!==hostConfig.launch||environments[0].selection.pageUrl!==pageUrl)throw Error('Preflight configuration differs from current assigned runtime/target');
   if(preflight.assignment.planDigest!==executionIdentity.planDigest||preflight.assignment.bindingDigest!==executionIdentity.bindingDigest||preflight.assignment.authorization.planDigest!==executionIdentity.planDigest||preflight.assignment.authorization.bindingDigest!==executionIdentity.bindingDigest)throw Error('Preflight authorization identity mismatch');
   await use(new PreflightRecorder(workerInfo.project.outputDir,executionIdentity,preflight.environmentId,workerInfo.workerIndex));
  }catch(error){await recordReadinessFailure(workerInfo.project.outputDir,executionIdentity,workerInfo.workerIndex,'preflight:configuration',error);throw error;}
 },{scope:'worker'}],
 browserEnvironment:[async({hostConfig,preflightRecorder,executionIdentity},use,workerInfo)=>{
  let environment:BrowserEnvironment;
  try{environment=await browserPreflight(hostConfig,preflightRecorder);}catch(error){await recordReadinessFailure(workerInfo.project.outputDir,executionIdentity,workerInfo.workerIndex,'host:session',error);throw error;}
  try{await use(environment);}finally{await environment.session.dispose();}
 },{scope:'worker'}],
 hostSession:[async({browserEnvironment},use)=>{await use(browserEnvironment.session);},{scope:'worker'}],
 assignedBrowser:[async({browserEnvironment,preflightRecorder,preflight,hostConfig},use)=>{
  await projectPreflight(browserEnvironment,preflightRecorder,preflight.projectRoot,preflight.projectPreflightHook,hostConfig.signal);
  await use(browserEnvironment.browser);
  // Preserve borrowed Chrome/profile. Worker exit disposes the Node client;
  // only the owned relay is stopped by browserEnvironment teardown.
 },{scope:'worker'}],
 assignedPage:async({assignedBrowser,browserEnvironment,preflightRecorder,preflight,pageUrl,hostConfig},use,testInfo)=>{
  const keys=testInfo.annotations.filter(a=>a.type==='testKey').map(a=>a.description);
  if(keys.length!==1||!keys[0]){await preflightRecorder.blocked('target','Explicit unique proof testKey required');throw Error('Explicit unique proof testKey required');}
  const claimIds=preflight.manifest.entries.filter(e=>e.testKey===keys[0]&&e.environmentId===preflight.environmentId).map(e=>e.claimId);
  if(!claimIds.length){await preflightRecorder.blocked('target','Current mapped proof obligations required',keys[0]);throw Error('Current mapped proof obligations required');}
  const started=Date.now();
  const target=await targetPreflight({...browserEnvironment,browser:assignedBrowser},preflightRecorder,{pageUrl,deadlineMs:hostConfig.readinessMs,assignment:preflight.assignment,planBytes:preflight.planBytes,claimIds,testKey:keys[0],signal:hostConfig.signal});
  await completeEnvironmentReady(browserEnvironment,target,preflightRecorder,{pageUrl,testKey:keys[0],deadlineMs:hostConfig.readinessMs-(Date.now()-started),signal:hostConfig.signal});
  const current=preflightRecorder.records.filter(r=>!r.testKey||r.testKey===keys[0]);
  await testInfo.attach('preflight',{body:Buffer.from(JSON.stringify(current)),contentType:'application/json'});
  await use(target.page);
  // Observable browser state survives proof teardown. Target disposal belongs
  // only to an explicitly assigned baseline reset or overall session termination.
 },
 environmentReady:[async({assignedPage},use)=>{await use();},{auto:true}],
 evidence:async({executionIdentity,assignedPage},use,testInfo)=>{if(!executionIdentity)throw Error('Execution identity required');await use(new EvidenceRecorder(testInfo,executionIdentity));}
});
