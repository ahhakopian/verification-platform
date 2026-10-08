import {readFileSync} from 'node:fs';
import type {Provider} from '../src/contracts/index.js';
// One indexed normative JSON resource supplies both planning and runtime
// discovery. There is no separately maintained descriptor constant.
export const descriptors:Provider[]=JSON.parse(readFileSync(new URL('../../contracts/generic-descriptors.json',import.meta.url),'utf8')).providers;
export const unavailableCapabilities=JSON.parse(readFileSync(new URL('../../contracts/unavailable-capabilities.json',import.meta.url),'utf8')).dispositions;
