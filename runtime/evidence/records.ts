import type {TestInfo} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {Evidence,ClaimRecord,ExecutionIdentity} from '../../src/contracts/index.js';
import {sha256} from '../../src/resources/resolve.js';
export class EvidenceRecorder {
 private sequence=0;
 constructor(private testInfo:TestInfo,readonly identity:ExecutionIdentity){}
 private async flush(name:string,record:unknown){const path=this.testInfo.outputPath(name+'.json');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(record,null,2)+'\n');await this.testInfo.attach(name,{path,contentType:'application/json'});return path;}
 async claim(record:Omit<ClaimRecord,'schemaVersion'|'identity'>){return this.flush(`claim-${record.claimId}-${record.environmentId}-${this.sequence++}`,{...record,schemaVersion:1,identity:this.identity});}
 async observation(evidence:Omit<Evidence,'schemaVersion'|'executionId'|'sequence'|'attachment'>,bytes:Uint8Array){const name=`evidence-${this.sequence++}`;const path=this.testInfo.outputPath(name+'.raw');await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);await this.testInfo.attach(name+'-raw',{path,contentType:'application/octet-stream'});return this.flush(name,{...evidence,schemaVersion:1,executionId:this.identity.executionId,sequence:this.sequence,attachment:{path,sha256:sha256(bytes)}});}
}
