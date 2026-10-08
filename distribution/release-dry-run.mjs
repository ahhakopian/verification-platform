import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {verify,sourceRoot} from './package-set.mjs';
import {sha256} from '../dist/src/resources/resolve.js';
const [root,bindingPath,outputPrefix,mode]=process.argv.slice(2);
if(!root||!bindingPath||!outputPrefix||(mode&&mode!=='--fixture-only'))throw Error('Usage: release-dry-run.mjs candidate exact-binding.json unused-output-prefix [--fixture-only]');
const {index}=verify(root,{binding:JSON.parse(readFileSync(bindingPath))});
if(!mode){const git=(...args)=>execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8'}).trim();const origin=git('remote','get-url','origin').replace(/^git@github\.com:/,'https://github.com/').replace(/\.git$/,'').replace(/\/$/,'');if(origin!==index.repository||git('status','--porcelain','--','.'))throw Error('Clean canonical platform source required');if(git('rev-parse','HEAD')!==index.sourceCommit)throw Error('Exact source commit unavailable');try{git('rev-parse','--verify','refs/tags/'+index.tag);throw Error('Release tag already exists; immutable identity cannot be reused');}catch(e){if(e.message==='Release tag already exists; immutable identity cannot be reused')throw e;}}
const archive=outputPrefix+'.tar.gz',metadata=outputPrefix+'.release.json',indexAsset=outputPrefix+'.resource-index.json';if(existsSync(archive)||existsSync(metadata)||existsSync(indexAsset))throw Error('Release assets already exist; refusing replacement');
// File list excludes explicit consumer-installed node_modules and any unindexed observations.
execFileSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','--mode=u+rw,go+r,go-w','-czf',archive,'-C',root,'resource-index.json',...index.resources.map(r=>r.path)]);
writeFileSync(indexAsset,readFileSync(join(root,'resource-index.json')));
writeFileSync(metadata,JSON.stringify({schemaVersion:1,repository:index.repository,tag:index.tag,sourceCommit:index.sourceCommit,fixtureOnly:mode==='--fixture-only',published:false,assets:[{name:index.tag+'.tar.gz',sha256:sha256(readFileSync(archive))},{name:'resource-index.json',sha256:sha256(readFileSync(join(root,'resource-index.json')))}]},null,2)+'\n');
console.log(JSON.stringify({archive,indexAsset,metadata,published:false}));
