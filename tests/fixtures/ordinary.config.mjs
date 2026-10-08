import {readFileSync} from 'node:fs';
import {defineConfig} from '@playwright/test';
const input=JSON.parse(readFileSync(process.env.VERIFICATION_REFERENCE_INPUT,'utf8'));
export default defineConfig({testDir:'.',testMatch:'ordinary.spec.ts',workers:1,fullyParallel:false,retries:0,outputDir:input.outputRoot,reporter:[['../../dist/runtime/reporter.js',{...input,resultPath:input.resultPath,sourceRoot:process.cwd()}]]});
