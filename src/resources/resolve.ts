import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import type { Binding, ResourceIndex, Resource } from '../contracts/index.js';
import { validateSchema } from '../validation/schema.js';
import {requiredExecutionResources,publicEntries} from './inventory.js';
export const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export interface ResolutionConfig { root: string; indexPath: string; mode: 'planning' | 'execution' }
export interface ResolvedBinding { binding: Binding; bindingDigest: string; index: ResourceIndex; indexDigest: string; resources: Map<string, {resource: Resource; path: string}> }
export function confined(root: string, path: string): string {
  if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error(`Resource path escapes distribution: ${path}`);
  const base = realpathSync(root); const target = realpathSync(resolve(base,path));
  const rel = relative(base,target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Resource path escapes distribution: ${path}`);
  return target;
}
export function resolveResources(binding: Binding, config: ResolutionConfig): ResolvedBinding {
  const errors = validateSchema('binding',binding);
  if (errors.length) throw new Error('Invalid binding: '+JSON.stringify(errors));
  const bytes = readFileSync(confined(config.root,config.indexPath));
  if (sha256(bytes)!==binding.index.sha256) throw new Error('Resource index digest mismatch');
  const index: ResourceIndex = JSON.parse(bytes.toString());
  const invalid = validateSchema('resource-index',index);
  if (invalid.length) throw new Error('Invalid resource index: '+JSON.stringify(invalid));
  for (const field of ['repository','tag','sourceCommit'] as const) if(index[field]!==binding[field]) throw new Error(`Mixed platform identity: ${field}`);
  const catalog = new Map(index.resources.map(r=>[r.id,r]));
  if(catalog.size!==index.resources.length) throw new Error('Duplicate resource IDs');
  if(new Set(index.resources.map(r=>r.path)).size!==index.resources.length) throw new Error('Duplicate resource paths');
  const selected = new Set<string>();
  const visit = (id:string) => {
    if(selected.has(id)) return;
    const r = catalog.get(id); if(!r) throw new Error(`Missing indexed resource: ${id}`);
    if(config.mode==='planning' && r.kind!=='normative') throw new Error(`Normative dependency is not normative: ${id}`);
    selected.add(id); for(const dep of r.dependencies) visit(dep);
  };
  for(const id of Object.values(binding.resources)) visit(id);
  if(config.mode==='execution') {
    for(const expected of requiredExecutionResources){const actual=catalog.get(expected.id);if(!actual||actual.path!==expected.path||actual.kind!==expected.kind)throw Error('Incomplete execution distribution: '+expected.id);}
    for(const [id,entry] of Object.entries(publicEntries))if(catalog.get(id)?.entry!==entry)throw Error('Missing/mismatched public execution entry: '+entry);
    for(const r of index.resources) visit(r.id);
    if(!index.resources.some(r=>r.kind==='runtime') || !index.resources.some(r=>r.kind==='frontend')) throw new Error('Incomplete execution distribution');
  }
  const resources: ResolvedBinding['resources'] = new Map();
  for(const id of selected) {
    const resource = catalog.get(id)!; const path = confined(config.root,resource.path);
    if(sha256(readFileSync(path))!==resource.sha256) throw new Error(`Resource digest mismatch: ${id}`);
    resources.set(id,{resource,path});
  }
  const schema=JSON.parse(readFileSync(resources.get(binding.resources.planSchema)!.path,'utf8'));
  if(schema.$schema!=='http://json-schema.org/draft-07/schema#'||schema.properties?.schemaVersion?.const!==1) throw new Error('Unsupported bound plan schema format');
  const descriptors=JSON.parse(readFileSync(resources.get(binding.resources.descriptors)!.path,'utf8'));
  const descriptorErrors=validateSchema('descriptor-set',descriptors);
  if(descriptorErrors.length) throw new Error('Invalid bound descriptors: '+JSON.stringify(descriptorErrors));
  return {binding,bindingDigest:sha256(JSON.stringify(binding)),index,indexDigest:sha256(bytes),resources};
}
