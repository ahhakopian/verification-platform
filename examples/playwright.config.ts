import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {RuntimeOptions} from '@verification-platform/support/runtime';
import {defineConfig} from '@playwright/test';
import type {Assignment,ExecutionIdentity,Manifest,ProjectPreflightHookReference} from '@verification-platform/support/contracts';
// Caller creates this identity-bound input after normal validation/authorization
// and obtains known WSL → Windows escalation before starting the runner.
const inputPath=process.env.VERIFICATION_INPUT;
if(!inputPath)throw Error('Explicit VERIFICATION_INPUT required');
const input: {projectRoot:string;planBytes:string;assignment:Assignment;identity:ExecutionIdentity;manifest:Manifest;resultPath:string;projectPreflightHook?:ProjectPreflightHookReference}=JSON.parse(readFileSync(inputPath,'utf8'));
if(input.assignment.environments.length!==1)throw Error('One explicitly assigned verification environment required');
const environment=input.assignment.environments[0];
const outputRoot=resolve(input.projectRoot,input.assignment.outputDirectory);
export default defineConfig<{},RuntimeOptions>({
 workers:1,fullyParallel:false,retries:0,testDir:'./generated',outputDir:outputRoot,
 use:{hostConfig:{runtimeConfig:environment.runtimeConfig,powershell:environment.powershell,launch:environment.launch,readinessMs:60000,disposalMs:5000},pageUrl:environment.selection.pageUrl,executionIdentity:input.identity,
  preflight:{projectRoot:input.projectRoot,environmentId:environment.id,assignment:input.assignment,planBytes:input.planBytes,manifest:input.manifest,projectPreflightHook:input.projectPreflightHook}},
 reporter:[['@verification-platform/support/reporter',{...input,plan:JSON.parse(input.planBytes),outputRoot,sourceRoot:input.projectRoot}]]
});
// Optional projectPreflightHook comes from existing caller-owned configuration:
// {contractVersion:1,entry:'.verification/preflight.mjs',sha256:<entry digest>,
//  deadlineMs:10000,input:<project JSON expectations>}. It is not in platform.json.
// Creation requires target-create/target-navigate in both normative claim and
// assigned effects and ownership.disposable=['target']. Normal proof assignments
// use ownership.cleanup=[]; preserve created pages and all observable browser state.
// Target disposal is explicit baseline reset or overall session termination only.
