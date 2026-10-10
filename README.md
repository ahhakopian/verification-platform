# Verification Platform development source

This repository working directory contains the approved single WSL → Windows platform. It is not evidence that the dedicated GitHub repository exists, a published release, or active-project adoption. [Implementation status](IMPLEMENTATION-PLAN.md) identifies completion evidence and remaining blockers.

Explicit development setup uses the exact lockfile (`npm ci --ignore-scripts`), then `npm run build`. Browser execution never installs dependencies or downloads a browser. Run `npm test` for bounded contracts/compiler/evidence/ordinary-runner compatibility, and the migrated Python/PowerShell suites named in the plan. Synthetic fixtures never establish deployed capability support.

One distribution exposes these entries under `@verification-platform/support`:

- `/validation`: `validatePlan` and JSON stdin CLI `verification-validate`.
- `/resources`: exact binding/index/content resolution with explicit local root/index/mode.
- `/contracts`: types and schemas for the public contracts.
- `/runtime`: caller-composed Playwright fixture, typed shared CDP/native/host helpers, evidence recording, canonical generic descriptors/readiness and loss-aware observations.
- `/reporter`: ordinary Playwright reporter using shared reconciliation.
- `/compilation`: actual explicit module discovery and complete source/coverage/typecheck validation.
- `/invocation`: ordinary Playwright command plus current result/crash/zero-test finalization.
- `/result-validation`: current plan/resources/provider/source/evidence verification and JSON stdin CLI `verification-validate-result`.

Both frontend skills live under `dist/frontends/` after build and resolve the shared `dist/runtime/` assets. The generic catalog reads the exact indexed normative `contracts/generic-descriptors.json` and its unavailable dispositions; all current deployed operations are unestablished. No model/agent routing lives in runtime. The browser frontend preserves the existing sequential routing and readable response; its typed adapter preserves raw facts/rejections/attachment state and uses the same mandatory-proof reconciler.

Browser-agent routing templates live beside that frontend under `agents/`.
For an explicitly authorized installation, replace
`@BROWSER_VERIFICATION_SKILL@` with the actual matching distribution's skill
path through the caller's normal agent configuration. Templates preserve the
existing Luna → Sol model/routing/policy and disabled automatic skill loading.
No personal path is a product default, and no installed agent configuration
is overwritten by build or assembly.

Consumers compose ordinary `test.extend` fixtures and supply exact plans/bindings, explicit fixture/provider imports, actual Windows runtime configuration, allowed effects/ownership and caller authorization. Use one worker, no full parallelism and zero retries for shared caller-owned Chrome/native desktop. Borrowed browser/profile/pages remain caller-owned. Missing permissions/capabilities/runtime block affected obligations without fallback or hidden retry.

The [preflight design and Sol Medium implementation handoff](docs/architecture/verification-platform-preflight.md) specifies the agreed BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY addition against v0.2.0. The shared runtime implements these setup stages; preflight readiness remains separate from product proof. Caller fixture configuration supplies current plan/assignment/manifest identities and the optional deterministic project hook; see the composition example.

Candidate assembly is described in [release procedure](distribution/RELEASE.md). Synthetic relocation fixtures passed; real source/release identity and active feature adoption are separate prerequisites. No tagging/upload/publication or consumer installation was performed.
