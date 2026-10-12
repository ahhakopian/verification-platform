# Verification Platform development source

> **Consumer installation and upgrade: AI agent only.** Verification Platform installation and upgrade in a consumer repository are supported **only through an AI agent running the packaged [Installation / Adoption workflow](frontends/verification-orchestrator/assets/installation-adoption.md)**. Manual consumer installation is not supported.
>
> Ask the AI agent to install or upgrade the Platform in the target repository. The agent owns technical discovery, integration, validation, remediation and continuation, and asks you only for genuine user-owned decisions, authorizations or external actions. This requirement applies to consumer installation; the developer setup below remains valid for developing, building and testing Verification Platform itself.

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
For an explicitly authorized installation, the installing AI agent replaces
`@BROWSER_VERIFICATION_SKILL@` with the actual matching distribution's skill
path through the caller's normal agent configuration. Templates define frontend
agent configuration; apply them through the caller’s normal configuration workflow.
No personal path is a product default, and no installed agent configuration
is overwritten by build or assembly.

## Installation / adoption

The packaged Installation / Adoption workflow governs AI-agent installation and upgrade for the selected published release. Installation-only state cannot receive adoption PASS. Adoption PASS requires both platform installation and consumer operational readiness for the applicable Verifier workflow.

Platform defines WHAT consumer integration must satisfy; the AI installer determines HOW from the current packaged contract and current native consumer sources. Native consumer code/configuration is the semantic authority. On every install, upgrade and recovery, freshly regenerate all required integration under `.verification/integration/`, even when old generated wiring appears valid. All integration-only files, including runners, fixtures, providers/declarations, readiness entries/probes, hooks, adapters and auxiliary bridges, are installer-owned generated output in this single directory. Previous generated integration has no preservation or requirement authority. Autonomously adapt/wrap/bridge/rewire technical incompatibilities within existing authorization. Confine writes by realpath; an escaping symlink is not ownership. Preserve native semantics, installed Platform bytes, checkpoint/approvals and retained evidence. No ownership registry, migration or old-layout cleanup is required. Reconcile active dispatches and reserved correction postconditions before replacing code; never replace code used by a running attempt. Recovery must freshly derive integration even after a completed configuration stage; identical current bytes may reuse still-valid evidence, while changed sources/configuration require fresh affected checks.

The installing AI agent owns convergence to a working Verifier: follow the packaged platform authorities below first and determine the required consumer-side integration from those explicit requirements. Inspect only the consumer sources needed to realize and validate that integration, freshly regenerate the required installer-owned integration yourself when safe and authorized. Do not independently expand requirements through open-ended interpretation of consumer plans, architecture, code or obligations. Missing or incompatible integration is installer work. ProjectPreflightHook remains optional and needed only for deterministic project-specific readiness checks; when required, create/update and wire the consumer hook using the complete shipped contract below. The hook remains observation-only; the installer performs setup/remediation outside it.

Follow these authorities from the same pinned distribution:

| Authority | Responsibility |
| --- | --- |
| [Installation and consumer adoption procedure](distribution/README.md#installation-and-consumer-adoption) | Release installation/upgrade, binding, integrity and consumer adoption requirements. |
| [Packaged Installation / Adoption workflow](frontends/verification-orchestrator/assets/installation-adoption.md) | Mandatory convergence process, checks, checkpoint/resume, remediation, HITL and cancellation. Installed path: `<distribution>/dist/frontends/verification-orchestrator/assets/installation-adoption.md`. |
| [ProjectPreflightHook consumer authoring contract](contracts/contracts.md#projectpreflighthook-consumer-authoring-contract) | Complete hook authoring/runtime requirements; read before creating or updating a hook. |
| [Verification Integration Contract](contracts/verification-integration.md) | Consumer/platform ownership, authorization and readiness/product-proof boundaries. |

BLOCKED, NEEDS_HITL, Unresolved and failed intermediate checks are nonterminal for installation. Exhaust safe and authorized autonomous resolution before HITL. Each HITL addresses one current user-owned decision, authorization or external action, with investigated concrete outcomes and material consequences rather than questionnaires or requests for discoverable/derivable raw technical values. Every HITL includes exactly one cancellation option labelled **Cancel Verifier installation**. Present only the current HITL, separately from normal progress/result reporting, then wait for the user's actual decision or requested external-action completion report.

After a non-cancel choice, the installer implements and validates the selected outcome within verified authorization. For external user actions, keep the request pending until completion is reported, then discover and validate the resulting state yourself. Validate and reassess before any subsequent HITL, and continue the same installation. Do not retry unchanged failures.

Report the normal terminal outcomes as:

- **INSTALLED** — the packaged workflow establishes verified adoption PASS with operational consumer integration.
- **USER_DECLINED** — the user explicitly cancels the entire installation; the workflow is durably `cancelled`. Only explicit cancellation terminates installation uninstalled.

Product Proof remains separate from installation/adoption; ENVIRONMENT READY does not establish Product PASS. The authorities above carry mandatory requirements without requiring reconstruction from unrelated source files. For architecture orientation, the [Installation / Adoption Workflow design](docs/architecture/verification-platform-installation-adoption.md) describes the implementation boundaries; follow the packaged authorities for installation.

The installer realizes installer-owned integration using ordinary `test.extend` fixtures and the exact plans/bindings, fixture/provider imports, Windows runtime configuration, allowed effects/ownership and caller authorization required by the packaged authorities. Use one worker, no full parallelism and zero retries for shared caller-owned Chrome/native desktop. Borrowed browser/profile/pages remain caller-owned. Missing permissions/capabilities/runtime block affected obligations without fallback or hidden retry.

The [preflight contract](docs/architecture/verification-platform-preflight.md) defines BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY. The shared runtime implements these setup stages; preflight readiness remains separate from product proof. Caller fixture configuration supplies current plan/assignment/manifest identities and the optional deterministic project hook; see the composition example.

Candidate assembly is described in [release procedure](distribution/RELEASE.md). Release assembly requires exact source/release identity; consumer adoption separately requires operational readiness.
