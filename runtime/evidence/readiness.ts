import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sha256} from '../../src/resources/resolve.js';
import type {ExecutionIdentity} from '../../src/contracts/index.js';
export const readinessFailurePath=(root:string,executionId:string,workerIndex:number)=>join(root,`runtime-readiness-${sha256(executionId)}-${workerIndex}.json`);
export async function recordReadinessFailure(root:string,identity:ExecutionIdentity|undefined,workerIndex:number,capability:string,error:unknown){
 if(!identity)return;
 const detail=error instanceof Error?error.message:String(error);
 const structured=error as {raw?:unknown;cleanupErrors?:string[]};
 try{await mkdir(root,{recursive:true});await writeFile(readinessFailurePath(root,identity.executionId,workerIndex),JSON.stringify({schemaVersion:1,identity,workerIndex,capability,phase:'readiness',attempted:false,category:'prerequisite',detail,raw:structured?.raw,cleanupErrors:structured?.cleanupErrors??[]})+'\n');}
 catch(collectionError){process.stderr.write('Readiness evidence collection error: '+String(collectionError)+'\n');}
}
