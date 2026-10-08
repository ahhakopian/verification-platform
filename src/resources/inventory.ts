// Shared assembly/resolution inventory for one complete platform set.
export const publicEntries = {
 'dist/runtime/index.js':'./runtime',
 'dist/runtime/reporter.js':'./reporter',
 'dist/runtime/invoke.js':'./invocation',
 'dist/src/compilation/bundle.js':'./compilation',
 'dist/src/validation/plan.js':'./validation',
 'dist/src/validation/result.js':'./result-validation',
 'dist/src/validation/cli.js':'verification-validate',
 'dist/src/validation/result-cli.js':'verification-validate-result',
 'dist/frontends/browser-verification/SKILL.md':'browser-verification',
 'dist/frontends/verification-orchestrator/SKILL.md':'verification-orchestrator'
} as const;
const modules = [
 'runtime/index','runtime/fixtures','runtime/catalog','runtime/readiness',
 'runtime/reporter','runtime/invoke','runtime/evidence/records','runtime/evidence/reconcile','runtime/evidence/readiness',
 'runtime/cdp/index','runtime/cdp/target-observer','runtime/cdp/network-observer','runtime/cdp/worker','runtime/cdp/permission','runtime/cdp/geometry',
 'runtime/host/wsl-windows/session','runtime/host/wsl-windows/process','runtime/host/wsl-windows/native',
 'src/contracts/index','src/compilation/bundle','src/compilation/coverage',
 'src/resources/resolve','src/resources/inventory','src/validation/schema',
 'src/validation/plan','src/validation/cli','src/validation/result','src/validation/result-cli',
 'frontends/browser-verification/result-adapter'
];
const assets = [
 'runtime/cdp/extension-action.cjs','runtime/cdp/extension-action.d.cts',
 'runtime/host/wsl-windows/browser-runtime.ps1','runtime/host/wsl-windows/browser-session.py',
 'runtime/host/wsl-windows/native-ui.ps1','runtime/host/wsl-windows/native-ui',
 'runtime/host/wsl-windows/wsl-windows-chrome-current.md',
 'frontends/browser-verification/SKILL.md','frontends/browser-verification/assets/playwright-cdp-timeout.md',
 'frontends/browser-verification/agents/browser-luna.toml.template','frontends/browser-verification/agents/browser-sol.toml.template',
 'frontends/verification-orchestrator/SKILL.md'
];
export const requiredExecutionResources = [...modules.flatMap(module=>[module+'.js',module+'.d.ts']),...assets].map(path=>({id:'dist/'+path,path:'dist/'+path,kind:path.startsWith('frontends/')?'frontend' as const:'runtime' as const}));
