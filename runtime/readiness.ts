import type {Provider,Readiness} from '../src/contracts/index.js';
export function capabilityReadiness(provider:Provider,environmentId:string,prerequisites:{available:boolean;reason:string;evidenceRefs:string[]}):Readiness[]{
 return provider.capabilities.map(c=>({schemaVersion:1,capabilityId:c.id,capabilityVersion:c.contractVersion,environmentId,status:c.support==='established'&&prerequisites.available&&prerequisites.evidenceRefs.length?'available':'unavailable',reason:c.support!=='established'?'Capability support is '+c.support:prerequisites.reason,evidenceRefs:[...new Set([...c.evidenceRefs,...prerequisites.evidenceRefs])]}));
}
