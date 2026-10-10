import {readFileSync} from 'node:fs';
import {defineConfig} from '@playwright/test';
const input=JSON.parse(readFileSync(process.env.VERIFICATION_REFERENCE_INPUT,'utf8'));
const assigned=input.assignment.environments[0];
export default defineConfig({testDir:'.',testMatch:'preflight.spec.ts',workers:1,fullyParallel:false,retries:0,outputDir:input.outputRoot,use:{executionIdentity:input.identity,pageUrl:assigned.selection.pageUrl,hostConfig:{runtimeConfig:assigned.runtimeConfig,powershell:assigned.powershell,launch:assigned.launch,readinessMs:1000,disposalMs:100},preflight:{projectRoot:process.cwd(),environmentId:assigned.id,assignment:input.assignment,planBytes:input.planBytes,manifest:input.manifest}},reporter:[['../../dist/runtime/reporter.js',{...input,plan:JSON.parse(input.planBytes),resultPath:input.resultPath,sourceRoot:process.cwd()}]]});
