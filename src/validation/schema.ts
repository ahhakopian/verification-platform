import AjvModule from 'ajv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Works from the compiled distribution; schemas remain indexed JSON resources.
const Ajv = AjvModule.default;
const ajv = new Ajv({ allErrors: true, strict: false });
export interface Diagnostic { path: string; code: string; message: string; referenceId?: string }
export function validateDocument(schema: object, value: unknown): Diagnostic[] {
  const validate=ajv.compile(schema);
  return validate(value) ? [] : (validate.errors ?? []).map(e=>({path:e.instancePath||'/',code:e.keyword,message:e.message??'Invalid value'}));
}
export function validateSchema(name: string, value: unknown): Diagnostic[] {
  const path = fileURLToPath(new URL(`../../../schemas/${name}.schema.json`, import.meta.url));
  const schema = JSON.parse(readFileSync(path, 'utf8'));
  const validate = ajv.getSchema(name) ?? ajv.addSchema(schema, name).getSchema(name)!;
  return validate(value) ? [] : (validate.errors ?? []).map(e => ({path:e.instancePath || '/', code:e.keyword, message:e.message ?? 'Invalid value'}));
}
