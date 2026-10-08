import type {Binding,Plan,Provider,Readiness,OwnedSession,Observer,Manifest,Evidence,Result,Invocation} from '../../src/contracts/index.js';
import {validatePlan} from '../../src/validation/plan.js';
import {resolveResources} from '../../src/resources/resolve.js';
type Contracts = [Binding,Plan,Provider,Readiness,OwnedSession,Observer<unknown>,Manifest,Evidence,Result,Invocation];
export type ConsumerContracts = Contracts;
export {validatePlan,resolveResources};
