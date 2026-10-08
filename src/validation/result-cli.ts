#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {validateResult} from './result.js';
try{const report=validateResult(JSON.parse(readFileSync(0,'utf8')));process.stdout.write(JSON.stringify(report)+'\n');process.exitCode=report.valid?0:2;}catch(error){process.stdout.write(JSON.stringify({valid:false,verdict:'BLOCKED',diagnostics:[String(error)]})+'\n');process.exitCode=2;}
