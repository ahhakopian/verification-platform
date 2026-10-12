import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const contractVersion=1;
export async function runPreflight(context){
 if(context.contractVersion!==1||context.input.purpose!=='platform-self-check'||!context.input.nonce||context.signal.aborted||!context.browser.isConnected()||context.browserProvenance.version!=='synthetic')throw Error('Invalid installed self-check context');
 const facts={purpose:'platform-self-check',synthetic:true,executionId:context.executionIdentity.executionId,environmentId:context.environmentId,input:context.input};
 const bytes=JSON.stringify(facts),path=join(context.evidenceDirectory,'canary.json');
 writeFileSync(path,bytes,{flag:'wx'});
 return {contractVersion:1,status:'READY',reason:'Installed hook machinery executed the indexed synthetic canary',evidence:[{path,sha256:createHash('sha256').update(bytes).digest('hex')}]};
}
