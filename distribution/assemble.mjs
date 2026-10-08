import {readFileSync} from 'node:fs';
import {assemble} from './package-set.mjs';
const [identityPath,output,mode]=process.argv.slice(2);
if(!identityPath||!output||(mode&&mode!=='--fixture-only'))throw Error('Usage: assemble.mjs explicit-release-identity.json empty-output-directory [--fixture-only]');
console.log(JSON.stringify(assemble(JSON.parse(readFileSync(identityPath,'utf8')),output,{fixtureOnly:mode==='--fixture-only'})));
