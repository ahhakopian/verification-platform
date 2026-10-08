import {test,expect} from '@playwright/test';
import {EvidenceRecorder} from '../../runtime/evidence/records.js';
import {readFileSync} from 'node:fs';
import {sha256} from '../../src/resources/resolve.js';
test('ordinary evidence API',{annotation:{type:'testKey',description:'version-key'}},async({},testInfo)=>{
 const input=JSON.parse(readFileSync(process.env.VERIFICATION_REFERENCE_INPUT!,'utf8'));
 const recorder=new EvidenceRecorder(testInfo,input.identity);
 const base={testKey:'version-key',claimId:'browser-version',environmentId:'assigned-chrome',attempted:true,evidenceIds:[],assertions:[],reason:'Synthetic ordinary-runner API compatibility attempt',errors:[],proofRelevantCleanupFailed:false};
 await recorder.claim({...base,outcome:'unresolved'});
 const raw=new TextEncoder().encode('{}');
 await recorder.observation({...input.evidence[0],evidenceId:'version-evidence'},raw);
 await test.step('observe',async()=>expect(JSON.parse(new TextDecoder().decode(raw))).toEqual({}));
 await recorder.claim({...base,outcome:'proved',evidenceIds:['version-evidence'],assertions:['version-match']});
});
