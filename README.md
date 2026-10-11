# Verification Platform development source

This repository contains the Verification Platform source for the supported WSL → Windows architecture.

Explicit development setup uses the exact lockfile (`npm ci --ignore-scripts`), then `npm run build`. Browser execution never installs dependencies or downloads a browser. Run `npm test` for bounded contracts/compiler/evidence/ordinary-runner compatibility, and the applicable Python/PowerShell suites. Synthetic fixtures never establish deployed capability support.

One distribution exposes these entries under `@verification-platform/support`:

- `/validation`: `validatePlan` and JSON stdin CLI `verification-validate`.
- `/resources`: exact binding/index/content resolution with explicit local root/index/mode.
- `/contracts`: types and schemas for the public contracts.
- `/runtime`: caller-composed Playwright fixture, typed shared CDP/native/host helpers, evidence recording, canonical generic descriptors/readiness and loss-aware observations.
- `/reporter`: ordinary Playwright reporter using shared reconciliation.
- `/compilation`: actual explicit module discovery and complete source/coverage/typecheck validation.
- `/invocation`: ordinary Playwright command plus current result/crash/zero-test finalization.
- `/result-validation`: current plan/resources/provider/source/evidence verification and JSON stdin CLI `verification-validate-result`.

Both frontend skills live under `dist/frontends/` after build and resolve the shared `dist/runtime/` assets. The generic catalog reads the exact indexed normative `contracts/generic-descriptors.json` and its unavailable dispositions. No model/agent routing lives in runtime. The browser frontend owns sequential agent routing and readable reports. Its typed adapter preserves raw facts/rejections/attachment state and uses the same mandatory-proof reconciler.

Browser-agent routing templates live beside that frontend under `agents/`.
For an explicitly authorized installation, replace
`@BROWSER_VERIFICATION_SKILL@` with the actual matching distribution's skill
path through the caller's normal agent configuration. Templates define frontend
agent configuration; apply them through the caller’s normal configuration workflow.
No personal path is a product default, and no installed agent configuration
is overwritten by build or assembly.

AI installers must follow the [installation and consumer adoption procedure](distribution/README.md#installation-and-consumer-adoption) after installing or upgrading a published release. Installation-only state cannot receive adoption PASS: inspect existing consumer plans/configuration and applicable obligations, supply only necessary consumer-owned integration, and establish operational readiness. Adoption PASS requires both platform installation and consumer operational readiness for the applicable Verifier workflow. ProjectPreflightHook is optional and needed only for deterministic project-specific readiness checks. Report BLOCKED when unresolved project decisions or required human actions prevent readiness.

The [Installation / Adoption Workflow design](docs/architecture/verification-platform-installation-adoption.md) specifies the approved minimal packaged workflow for a separate implementation task.

Consumers compose ordinary `test.extend` fixtures and supply exact plans/bindings, explicit fixture/provider imports, actual Windows runtime configuration, allowed effects/ownership and caller authorization. Use one worker, no full parallelism and zero retries for shared caller-owned Chrome/native desktop. Borrowed browser/profile/pages remain caller-owned. Missing permissions/capabilities/runtime block affected obligations without fallback or hidden retry.

The [preflight contract](docs/architecture/verification-platform-preflight.md) defines BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY. The shared runtime implements these setup stages; preflight readiness remains separate from product proof. Caller fixture configuration supplies current plan/assignment/manifest identities and the optional deterministic project hook; see the composition example.

Candidate assembly is described in [release procedure](distribution/RELEASE.md). Release assembly requires exact source/release identity; consumer adoption separately requires operational readiness.
