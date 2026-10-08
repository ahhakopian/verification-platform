import {readFileSync} from 'node:fs';
import {verify,snapshot} from './package-set.mjs';
const [command,root,bindingPath,output]=process.argv.slice(2);
if(!root||!bindingPath)throw Error('Usage: check.mjs full|normative|snapshot root exact-binding.json [empty-snapshot-output]');
const binding=JSON.parse(readFileSync(bindingPath));
if(command==='snapshot'){if(!output)throw Error('Snapshot output required');snapshot(root,output,binding);}else if(command==='full'||command==='normative')verify(root,{binding,mode:command==='full'?'execution':'planning'});else throw Error('Unknown check command');
console.log(JSON.stringify({status:'valid',command,tag:binding.tag,published:false}));
