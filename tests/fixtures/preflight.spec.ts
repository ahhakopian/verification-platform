import {test as platform,expect} from '../../dist/runtime/fixtures.js';
import type {BrowserEnvironment} from '../../dist/runtime/preflight.js';
// Only host acquisition is synthetic. Exercise the ordinary platform hook,
// target fixture, automatic READY gate and reporter without Windows effects.
const test=platform.extend<{}, {browserEnvironment:BrowserEnvironment}>({
 browserEnvironment:[async({preflightRecorder,pageUrl},use)=>{
  const pages:any[]=[];
  const browser:any={isConnected:()=>true,contexts:()=>[context]};
  const context:any={browser:()=>browser,pages:()=>pages,newPage:async()=>{
   let url='about:blank',closed=false;
   const page:any={url:()=>url,isClosed:()=>closed,context:()=>context,goto:async(value:string)=>{url=value;},waitForLoadState:async()=>{},close:async()=>{closed=true;}};
   pages.push(page);return page;
  },newCDPSession:async(page:any)=>({send:async()=>({targetInfo:{targetId:'fixture-target',type:'page',url:page.url()}}),detach:async()=>{}})};
  const provenance={binary:'C:\\fixture\\chrome.exe',profile:'C:\\fixture\\profile',version:'fixture',process_id:123,started_at:'fixture-start',webSocketDebuggerUrl:'ws://127.0.0.1:9317/devtools/browser/fixture'};
  await preflightRecorder.append({stage:'browser',status:'RECOVERED',reason:'Synthetic host acquisition',observations:provenance,evidence:[],cleanupErrors:[]});
  await use({browser,provenance,session:{endpoint:provenance.webSocketDebuggerUrl,provenance,revalidate:async()=>{},dispose:async()=>{}}});
  // This worker resumes after assignedPage teardown. No real browser is used.
  expect(pages).toHaveLength(1);
  expect(pages[0].isClosed()).toBe(false);
 },{scope:'worker'}]
});
test('ordinary preflight gate',{annotation:{type:'testKey',description:'version-key'}},async({preflightRecorder})=>{
 // The body deliberately does not request assignedPage; the automatic fixture
 // still must complete the gate before this setup-only acceptance body starts.
 expect(preflightRecorder.records.map(r=>r.status)).toEqual(['RECOVERED','PASS','CREATED','ENVIRONMENT READY']);
});
