#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {validatePlan} from './plan.js';
try {
  const input=JSON.parse(readFileSync(0,'utf8'));
  const result=validatePlan(input); process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.valid?0:2;
} catch(error) {process.stdout.write(JSON.stringify({valid:false,diagnostics:[{path:'/',code:'input',message:String(error)}]})+'\n');process.exitCode=2;}
