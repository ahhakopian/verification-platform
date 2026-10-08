import {defineConfig} from '@playwright/test';
export default defineConfig({workers:1,fullyParallel:false,retries:0,testDir:'./generated',outputDir:'./verification-output'});
// Supply explicit hostConfig, pageUrl, executionIdentity and reporter options
// from the caller's ordinary configuration. No browser/site/profile defaults.
