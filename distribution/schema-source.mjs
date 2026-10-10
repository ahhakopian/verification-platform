// The schema definitions are maintained here; emit deterministically with this script.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../schemas/', import.meta.url));
mkdirSync(root, {recursive:true});
const str = {type:'string',minLength:1};
const digest = {type:'string',pattern:'^[a-f0-9]{64}$'};
const version = {const:1};
const list = (items,minItems=0) => ({type:'array',items,minItems});
const names = (min=0) => ({...list(str,min),uniqueItems:true});
const enumOf = (...values) => ({enum:values});
const obj = (properties,optional=[]) => ({type:'object',additionalProperties:false,properties,required:Object.keys(properties).filter(k=>!optional.includes(k))});
const ref = obj({id:str,path:str,reference:str});
const config = obj({id:str,path:str,disposition:enumOf('planned','realized'),purpose:enumOf('fixture','provider-declaration','setup')});
const proof = obj({id:str,source:str,description:str,mandatory:{type:'boolean'},acceptedSources:list(obj({source:str,providerId:str}),1),capabilityId:str,capabilityVersion:str},['capabilityId','capabilityVersion']);
const timing = obj({deadlineMs:{type:'integer',minimum:1},observationWindowMs:{type:'integer',minimum:1},completionBoundary:str},['observationWindowMs','completionBoundary']);
const claim = obj({id:str,sourceRefs:names(1),expected:str,proof:list(proof,1),environmentIds:names(1),prerequisiteIds:names(),mode:enumOf('automated','assisted','human'),allowedEffects:names(),timing,support:obj({disposition:enumOf('generic','project-planned','project-existing','unavailable'),reason:str,configurationRefs:names()})});
const release = {repository:{type:'string',pattern:'^https://github\\.com/[^/]+/[^/]+$'},tag:{type:'string',pattern:'^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$'},sourceCommit:{type:'string',pattern:'^[a-f0-9]{40}$'}};
const binding = obj({schemaVersion:version,...release,index:obj({asset:str,sha256:digest}),resources:obj({integration:str,planSchema:str,descriptors:str})});
const resource = obj({id:str,path:str,sha256:digest,formatVersion:version,kind:enumOf('normative','runtime','frontend'),dependencies:names(),entry:str},['entry']);
const capability = obj({id:{type:'string',pattern:'^[^: ]+:[^: ]+$'},contractVersion:str,export:str,inputType:str,outputType:str,support:enumOf('unestablished','established','unavailable'),constraints:names(),observations:names(),limits:names(),effects:names(),ownership:str,prerequisites:names(),deadlineMs:{type:'integer',minimum:1},evidenceRefs:names()});
const provider = obj({schemaVersion:version,id:str,version:str,entry:str,declarations:str,capabilities:list(capability)});
const providers = list(obj({id:str,version:str}));
const identity = obj({executionId:str,attempt:{type:'integer',minimum:1},planDigest:digest,bindingDigest:digest,assignmentDigest:digest,generatedSourceDigest:digest,fixtureDigest:digest,providerSources:list(obj({id:str,version:str,entry:str,entryDigest:digest,declarations:str,declarationsDigest:digest})),providers,provenance:obj({runtime:str,build:str,tools:{type:'object',additionalProperties:str}})});
const assignment = obj({schemaVersion:version,planDigest:digest,bindingDigest:digest,authorization:obj({reference:str,planDigest:digest,bindingDigest:digest,allowedEffects:names()}),environments:list(obj({id:str,build:str,runtimeConfig:str,powershell:str,launch:{type:'boolean'},selection:obj({pageUrl:str}),exclusive:{const:true}}),1),fixtureEntry:str,runnerConfig:str,providers:list(obj({id:str,version:str,entry:str})),outputDirectory:str,ownership:obj({borrowed:names(),disposable:names(),cleanup:names()}),evidenceConstraints:names()});
const entry = obj({claimId:str,environmentId:str,sourceRefs:names(1),proofIds:names(1),mode:enumOf('automated','assisted','human'),testKey:str,source:str,title:str,assertions:names(),steps:names(),capabilityIds:names(),capabilityVersions:{type:'object',additionalProperties:str},blocker:str},['testKey','source','title','blocker']);
const evidence = obj({schemaVersion:version,testKey:str,executionId:str,evidenceId:str,claimId:str,environmentId:str,proofIds:names(1),source:str,provider:obj({id:str,version:str}),sequence:{type:'integer',minimum:0},identities:list(obj({namespace:str,value:str}),1),window:obj({start:str,end:str,complete:{type:'boolean'},loss:names()}),attachment:obj({path:str,sha256:digest}),facts:{}});
const verdict = enumOf('PASS','FAIL','BLOCKED','INCONCLUSIVE');
const result = obj({schemaVersion:version,identity,verdict,claims:list(obj({claimId:str,environmentId:str,verdict,reason:str,evidenceIds:names()}),1),counts:obj({PASS:{type:'integer',minimum:0},FAIL:{type:'integer',minimum:0},BLOCKED:{type:'integer',minimum:0},INCONCLUSIVE:{type:'integer',minimum:0}}),runner:obj({exitCode:{type:['integer','null']},status:str}),limitations:names()});
const schemas = {
 'browser-verification-plan':obj({schemaVersion:version,planId:str,sourceReferences:list(ref,1),environments:list(obj({id:str,topology:{const:'wsl-windows'},description:str}),1),prerequisites:list(obj({id:str,description:str,dependsOn:names()})),configurationReferences:list(config),claims:list(claim,1)}),
 binding,'resource-index':obj({schemaVersion:version,...release,resources:list(resource,1)}),
 'provider-descriptor':provider,'descriptor-set':obj({schemaVersion:version,providers:list(provider)}),
 assignment,'coverage-manifest':obj({schemaVersion:version,identity,entries:list(entry,1)}),evidence,result,
 'claim-record':obj({schemaVersion:version,testKey:str,identity,claimId:str,environmentId:str,attempted:{type:'boolean'},outcome:enumOf('proved','contradicted','unresolved','blocked'),evidenceIds:names(),assertions:names(),reason:str,errors:list(obj({category:str,phase:enumOf('readiness','action','observation','cleanup'),detail:str})),proofRelevantCleanupFailed:{type:'boolean'}}),
 invocation:obj({schemaVersion:version,planPath:str,planDigest:digest,binding,assignment})
};
schemas.readiness=obj({schemaVersion:version,capabilityId:str,environmentId:str,status:enumOf('available','unavailable'),reason:str,evidenceRefs:names()});
schemas['invocation-return']=obj({schemaVersion:version,status:enumOf('generated','generation-blocked','complete'),bundle:names(),manifest:str,result:str,evidence:names(),runnerExitCode:{type:['integer','null']},acceptanceExitCode:{type:'integer',minimum:0},diagnostics:names()},['bundle','manifest','result']);
schemas.preflight=obj({schemaVersion:version,identity,environmentId:str,workerIndex:{type:'integer',minimum:0},testKey:str,sequence:{type:'integer',minimum:0},stage:enumOf('browser','project','target','gate'),status:str,reason:str,observations:{type:'object'},evidence:list(obj({path:str,sha256:digest})),cleanupErrors:list({type:'string'})},['testKey']);
schemas.preflight.allOf=[['browser',['PASS','RECOVERED','BLOCKED']],['project',['PASS','BLOCKED']],['target',['PASS','CREATED','BLOCKED']],['gate',['ENVIRONMENT READY','PREFLIGHT_BLOCKED']]].map(([stage,statuses])=>({if:{properties:{stage:{const:stage}}},then:{properties:{status:enumOf(...statuses)}}}));
for(const [name,schema] of Object.entries(schemas)) writeFileSync(root+name+'.schema.json',JSON.stringify({$schema:'http://json-schema.org/draft-07/schema#',...schema},null,2)+'\n');
