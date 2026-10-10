export {test,expect} from '@verification-platform/support/runtime';
// Configure preflight through the caller's ordinary runner configuration.
// Project proof fixtures depend on assignedPage so they begin after the
// automatic ENVIRONMENT READY gate. Concrete readiness hooks remain project
// code; they are not proof providers. Borrowed browser/profile/pages survive.
