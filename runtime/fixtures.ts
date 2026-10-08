import {test as base,expect,chromium,type Browser,type Page,type TestInfo} from '@playwright/test';
import type {OwnedSession,ExecutionIdentity} from '../src/contracts/index.js';
import {acquireSession,type HostConfig} from './host/wsl-windows/session.js';
import {EvidenceRecorder} from './evidence/records.js';
import {recordReadinessFailure} from './evidence/readiness.js';
export {expect};
export interface RuntimeOptions {hostConfig:HostConfig;pageUrl:string;executionIdentity:ExecutionIdentity}
export async function assignedPageReady(browser:Browser,pageUrl:string,identity:ExecutionIdentity,testInfo:TestInfo):Promise<Page>{
 try{if(!pageUrl)throw Error('Explicit unique page URL required');const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url()===pageUrl);if(pages.length!==1)throw Error('Assigned borrowed page must match exactly once');return pages[0];}
 catch(error){const keys=testInfo.annotations.filter(a=>a.type==='testKey').map(a=>a.description);if(identity&&keys.length===1&&keys[0]){const detail=error instanceof Error?error.message:String(error);try{await testInfo.attach('readiness-selection',{body:Buffer.from(JSON.stringify({schemaVersion:1,identity,testKey:keys[0],phase:'readiness',attempted:false,category:'prerequisite',detail})),contentType:'application/json'});}catch(collectionError){process.stderr.write('Readiness evidence collection error: '+String(collectionError)+'\n');}}throw error;}
}
export const test=base.extend<{assignedPage:Page;evidence:EvidenceRecorder},RuntimeOptions&{assignedBrowser:Browser;hostSession:OwnedSession}>({
 hostConfig:[undefined as unknown as HostConfig,{option:true,scope:'worker'}],
 pageUrl:['',{option:true,scope:'worker'}],executionIdentity:[undefined as unknown as ExecutionIdentity,{option:true,scope:'worker'}],
 hostSession:[async({hostConfig,executionIdentity},use,workerInfo)=>{let session:OwnedSession;try{if(!hostConfig)throw Error('Explicit runtime configuration required');session=await acquireSession(hostConfig);}catch(error){await recordReadinessFailure(workerInfo.project.outputDir,executionIdentity,workerInfo.workerIndex,'host:session',error);throw error;}try{await use(session);}finally{await session.dispose();}},{scope:'worker'}],
 assignedBrowser:[async({hostSession,executionIdentity},use,workerInfo)=>{let browser:Browser;try{await hostSession.revalidate();browser=await chromium.connectOverCDP(hostSession.endpoint);}catch(error){await recordReadinessFailure(workerInfo.project.outputDir,executionIdentity,workerInfo.workerIndex,'chrome:attachment',error);throw error;}await use(browser);
   // Borrowed persistent Chrome is preserved. Worker process exit disposes the
   // owned Node client; the accepted host experiment establishes this path.
   // No browser.close(), context.close() or Browser.close protocol action.
 },{scope:'worker'}],
 assignedPage:async({assignedBrowser,pageUrl,executionIdentity},use,testInfo)=>{const page=await assignedPageReady(assignedBrowser,pageUrl,executionIdentity,testInfo);await use(page);},
 evidence:async({executionIdentity},use,testInfo)=>{if(!executionIdentity)throw Error('Execution identity required');await use(new EvidenceRecorder(testInfo,executionIdentity));}
});
