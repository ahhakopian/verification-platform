# Installation / Adoption Workflow

Status: approved minimal design for a separate implementation task. This document specifies future packaged behavior; it does not claim that the workflow, checkpoint, hook self-check, or readiness adapter is implemented. The existing release installation/adoption contract remains authoritative until its normal publication incorporates the implementation.

## 1. Purpose and scope

Make AI-driven installation and upgrade converge a consumer repository to an operational Verifier installation. Installing release files, selecting a binding, passing integrity checks, or installing frontend skills/agents establishes platform installation only. Successful adoption also requires demonstrated consumer operational readiness for the applicable Verifier workflow.

The workflow consumes the selected immutable published platform release, applicable consumer plans/configuration/obligations, and existing project authorization. It establishes only necessary consumer-owned execution/readiness integration. It stops before product proof and performs no consumer product acceptance.

This design formalizes the [installation/adoption instructions](../../distribution/README.md#installation-and-consumer-adoption), [Verification Integration Contract](../../contracts/verification-integration.md), and [public preflight contracts](../../contracts/contracts.md#preflight-contracts). Implementation must reuse those boundaries.

## 2. Architectural boundaries and non-goals

The workflow belongs to the installation-facing frontend. AI inspects project semantics and authors authorized integration; deterministic platform helpers validate inputs, run bounded checks, and collect evidence. Runtime remains the shared deterministic execution implementation, without AI decisions or process-registry interpretation.

There are only four new responsibilities:

1. A packaged installation/adoption frontend or bounded entry in the existing frontend.
2. A small consumer-local adoption checkpoint.
3. A deterministic installed-platform hook self-check extending the shipped smoke.
4. A narrow readiness-only invocation/report adapter using the actual consumer execution path.

These are responsibilities, not four mandatory subsystems. Extend the existing orchestrator's installation entry, smoke, and invocation support where appropriate. No new orchestration framework, prerequisite DSL, generic remediation engine, hook chaining, product-proof contract, complex journal, or checkpoint migration framework is authorized. No consumer-specific behavior belongs in platform code. No changes to consumer product code, generic capability semantics, driver topology, or product verdict reconciliation are part of this design.

## 3. Final workflow and stage semantics

```text
INSTALL / UPGRADE
  → CONFIGURE CONSUMER
  → PLATFORM SELF-CHECK
  → CONSUMER READINESS PROBE
  → ADOPTION ASSESSMENT
  → PASS

Failed check → diagnose → one safe authorized correction → fresh affected check
No safe autonomous next step → HITL / BLOCKED
```

| Stage | Required work and completion boundary |
| --- | --- |
| INSTALL / UPGRADE | Install the explicitly selected published release through existing installation conventions. Prepare locked dependencies explicitly. Validate binding, index identity, indexed resources and complete execution integrity. Configure matching frontend/agent paths through the consumer's normal configuration workflow. Do not select an unpinned latest version. |
| CONFIGURE CONSUMER | Inspect existing plans, configuration and applicable obligations under the pinned platform instructions. Preserve valid integration; realize only missing or demonstrably incompatible consumer-owned fixture/runner/provider/invocation/readiness wiring. Establish the hook decision and identify which existing checks cover applicable prerequisites. Planned references alone are insufficient. |
| PLATFORM SELF-CHECK | Run the installed deterministic smoke, including the isolated hook mechanism check in section 5. Completion requires successful installed-code execution and valid self-check evidence. |
| CONSUMER READINESS PROBE | Run the setup-only probe through the actual consumer fixture and runner configuration. Establish current BrowserPreflight, project stage, TargetPreflight and ENVIRONMENT READY; finish the worker and temporary-resource teardown normally. |
| ADOPTION ASSESSMENT | Match the demonstrated configuration/readiness to all applicable consumer prerequisites. Confirm callable required integration, evidence validity and normal probe completion. Identify any custom fixture, provider/native readiness, authorization or human prerequisite not established by the shared gate. |
| PASS | All conditions in section 7 hold for the selected release and current consumer inputs. Record completion and evidence references. |

Execute each applicable assigned environment/target serially. Do not assume one gate proves different configurations, or add unrelated environments or scenarios. Existing valid evidence may be reused only for the properties and identities it still establishes.

## 4. Hook decision contract

The installer records one of three explicit decisions scoped to the applicable plans, environment and configuration:

| Decision | Meaning and action |
| --- | --- |
| HookRequired | Applicable deterministic project-specific readiness conditions are not established by the shared stages or other valid integration. Preserve, create or update the necessary consumer-owned hook and reference it from runner/fixture configuration. |
| HookNotRequired | Applicable readiness conditions are covered without a project hook. Record the source-backed rationale; the runtime's deliberate no-hook project stage is valid. |
| Unresolved | Governing sources are missing or contradictory, or the required readiness behavior depends on an unresolved project decision. Do not infer HookNotRequired or manufacture a hook. Use the project's decision/HITL path and report BLOCKED when no autonomous safe next step exists. |

Determine the decision from platform installation/adoption instructions and contracts, consumer verification plans/configuration, and applicable obligations. Hook absence is not evidence for HookNotRequired. A platform canary is not evidence about this decision.

Preserve and exercise an existing valid configured hook unless removal is independently justified by the consumer's governing sources and authorization. Do not silently drop it to reach READY. If existing configuration and the assessment disagree, reconcile that disagreement before probing. Record the rationale and relevant input fingerprint; re-evaluate on changes to its sources or configuration.

The consumer hook remains checked-in deterministic consumer code. Use the existing contract version, relative entry, entry SHA-256, JSON input and positive deadline. Keep its reference outside `.verification/platform.json`. Hook code observes readiness and writes evidence; it does not install, enable, reload or otherwise perform persistent setup.

## 5. Platform self-check design

Extend the existing shipped deterministic smoke rather than add a live canary workflow. Exercise the actual installed `projectPreflight` and evidence implementation using a controlled synthetic browser/session. No Windows host acquisition, CDP attachment or Chrome launch is needed.

The bounded check must:

1. Verify the selected distribution and obtain the canary bytes/digest through its resource index.
2. Create an isolated scratch project root and evidence directory. Copy the exact indexed canary module into that root; do not edit the indexed distribution or any consumer hook.
3. Create a fresh self-check execution identity and recorder. Append an explicitly synthetic browser-stage record and supply controlled `isConnected`/session revalidation behavior satisfying the hook's existing preconditions. Synthetic provenance must never be presented as an actual browser observation.
4. Reference the confined canary by its relative entry, digest, supported version, bounded deadline and explicit JSON input. The canary checks delivered context/input and writes fresh evidence including the current execution/environment identity and received input. It returns READY with the actual evidence digest.
5. Call the installed `projectPreflight`, then verify its project PASS record, hook entry/input identities, canary observations and persisted evidence using existing collection/validation helpers. Complete the smoke normally and record its terminal outcome.

This proves installed hook loading, execution, context delivery, result validation and evidence persistence. It proves neither live browser acquisition nor consumer readiness. It need not call TargetPreflight or ENVIRONMENT READY. Its successful two-stage prefix is a mechanism check, not a complete consumer preflight.

The canary, synthetic support and self-check output remain independent of the actual consumer hook. Keep realpath confinement and the single project-stage ordering unchanged. No absolute external hook reference, escaping symlink, synthetic consumer READY record or hook chaining is allowed. Existing dependency/runner smoke remains part of the lightweight installed-platform check.

## 6. Consumer readiness-probe design

Use the actual configured consumer fixture entry and runner configuration, exact selected runtime/profile/target, and current project hook configuration. A platform-only fixture or direct call to low-level stages is insufficient to demonstrate the consumer execution wiring.

The adapter runs an ordinary setup-only probe with one worker, `fullyParallel:false` and zero retries. The probe imports the configured consumer fixture's `test`/`expect`, requests the existing readiness gate and any explicitly required safe readiness fixtures, then returns without product assertions/actions or product evidence recording. Do not collect or execute product test bodies. Existing runner/fixture setup and teardown still execute; their effects must be understood and authorized before invocation. Do not silently suppress required consumer setup to obtain PASS.

### Input and selection bridge

Reuse existing plan bytes, binding/resolution, assignment, execution identity, fixture/provider source identities and host options. Validate realized configuration and actual callable exports before effects. Record the actual probe-source digest and runner/configuration fingerprint, rather than borrowing a product bundle identity for changed source.

The current fixture requires a coverage manifest and an annotated mapped proof `testKey`; current `invokePlaywright` requires a complete product bundle. These are known adapter gaps, not permission to create fake proof mappings. The readiness adapter needs a bounded setup-selection context carrying the selected environment, existing claim IDs and a unique probe `testKey`. Validate selection against the original plan/assignment and all existing target effect/ownership restrictions. This context selects setup authorization only; it is not a replacement product manifest or executable prerequisite language.

Implement that context as the narrow readiness-only bridge in the shared fixture/invocation boundary. Reuse configuration/identity checks. Normal product execution must retain its existing manifest, coverage, source and annotation requirements; a readiness invocation must not let product execution bypass them. Where a current manifest exists, use it as source context without changing its product obligations. Readiness must not require generating a product-proof bundle merely to run setup.

Use the consumer's normal configuration composition to supply the readiness context and select only the probe. A bounded runner overlay may change probe selection, isolated output/report destination and execution context, while preserving the configured fixture, host, target, hook, relevant setup and effects. Check and record those effective values. If the consumer's runner cannot express this safely, make only the necessary consumer-owned wiring change, or report BLOCKED; do not fall back to another fixture.

### Execution and completion

The existing stages execute in order:

```text
BrowserPreflight
  → actual configured consumer ProjectPreflightHook, or explicit no-hook stage
  → TargetPreflight
  → flushed ENVIRONMENT READY
  → setup-only probe returns
  → ordinary fixture teardown / temporary-resource disposal
```

Validate current sidecars, identity, order, target/browser continuity, hook evidence when present, normal runner completion, and relevant disposal diagnostics. A printed READY line or zero runner exit without adequate records is insufficient. A crashed worker after READY has not completed the probe normally.

The adapter returns a small readiness summary with execution identity, effective configuration fingerprint, check outcome/reason, runner status/exit and evidence references. It must use a readiness-specific output location; do not write a product `Result`, calculate product acceptance, or emit passing product claim records. Existing `PreflightRecord` sidecars remain the detailed readiness evidence format.

The gate establishes configured browser/project/target setup only. It does not automatically initialize unrequested custom fixtures, establish every provider/native capability, prove application-specific usability, or cover prerequisites omitted from configuration. Section 7 requires the applicability assessment to close those gaps using existing bounded readiness/validation evidence; absence of such evidence blocks adoption.

## 7. Adoption PASS, HITL and BLOCKED

Adoption PASS requires all of the following together:

- The installed published release and binding/indexed resources are valid and coherent, including matching frontend configuration.
- The installed deterministic platform self-check succeeded.
- Necessary consumer-owned integration is realized and callable for the applicable workflow.
- The hook decision is resolved and consistent with exercised configuration.
- Current consumer readiness evidence is valid and every required probe completed normally at ENVIRONMENT READY.
- All applicable readiness prerequisites are covered by the probe or other still-valid bounded evidence; none remains unresolved.

Adoption readiness remains separate from product proof and Human Acceptance.

HITL is a pending external action/authorization, not a successful check. Persist the specific requested action, reason and applicable authorization reference before waiting. Existing hook NEEDS_HITL observations provide action/reason information, but do not grant permission. Resume the same adoption workflow after a supplied decision/action/authorization and revalidation; run a fresh affected check.

BLOCKED means there is no authorized safe next step available autonomously. Report the cause, affected stage/evidence and required next action/owner, even if platform installation passed. Missing/contradictory decisions, external prerequisites, authorization needs and unresolved platform defects qualify. No speculative corrections must be attempted merely to exhaust remediation.

An individual failed assertion can produce a check FAIL. A setup prerequisite produces BLOCKED through the existing preflight semantics. Missing/lost/stale evidence remains inadequate or INCONCLUSIVE where that distinction applies; it never becomes PASS. These check outcomes do not alter product verdict semantics. The frontend first applies section 8 when a permitted correction exists; otherwise it reports pending HITL/BLOCKED rather than abandoning the work silently.

## 8. Remediation rules

Use only: exact diagnosed cause → one narrow authorized deterministic correction → fresh affected check.

The correction must follow defined intended behavior, preserve valid consumer integration and stay within installation/readiness wiring. Examples include restoring incomplete installation from the exact published bytes or fixing a demonstrated configuration-reference defect. An incorrect hook digest may be corrected only after establishing that the referenced consumer code is the intended authorized code; do not bless unexplained edits.

Record the defect identity, correction intent, relevant before/after input identity and evidence reference. Persist the correction marker before dispatching the correction. If interrupted, inspect actual resulting files/state to determine whether it occurred; do not blindly repeat it. A different cause requires its own evidence-backed diagnosis, not renaming an unchanged failure to continue retrying.

Do not retry unchanged failures, broaden permissions, weaken checks, guess product requirements, change product code, or perform speculative persistent browser setup. Repeated, uncertain, unauthorized or unrepairable causes require HITL/BLOCKED. No arbitrary retry counter or generic remediation engine is needed.

A rerun is a fresh explicit execution attempt with its own identity/output, never a hidden runner retry. Rerun only the affected check, but include its required stage dependencies. Changes to consumer configuration/hook/runtime or HITL environment actions require a fresh consumer preflight sequence. Do not append another project hook to a completed sequence, replace identity during an atomic check, or resume at target setup using stale browser/project observations. Unaffected release integrity/self-check evidence may be reused when its identity and validity remain unchanged.

## 9. Checkpoint and resume contract

Use one consumer-local `.verification/adoption.json` checkpoint, separate from `.verification/platform.json`. It is installer-owned workflow metadata, not a process approval registry. A small supported format is sufficient; no migration framework is required. Unknown formats block safe resume rather than being guessed.

| Field/responsibility | Minimum information |
| --- | --- |
| Format | Format version. |
| Consumer | Canonical consumer root identifying the repository being converged. |
| Selection | Selected repository/tag/source commit and binding/index digest, with reference to the existing binding. Version alone is insufficient. |
| Progress | Current workflow stage and its active, waiting, blocked or completed status. |
| Hook decision | HookRequired / HookNotRequired / Unresolved, short rationale/source references and relevant input fingerprint. |
| Last check | Check kind, execution identity, outcome/reason and evidence/summary reference. Keep successful applicable check references in existing assessment evidence. |
| Active dispatch | Operation/check identity, input/command fingerprint, dispatch status and handle/reference when running; null when inactive. Persist intent before dispatch. |
| Pending HITL | Action, reason, affected scope and authorization/request reference; null when none. |
| Current defect | Diagnosis identity/evidence reference and whether its permitted correction has been reserved/applied. No detailed repair history is duplicated. |

Detailed attempt history, observations and diagnostics stay in existing evidence artifacts. A compact adoption assessment records input identity and references to the applicable integrity, self-check, readiness and prerequisite evidence; the checkpoint points to it rather than copying it.

Write checkpoint updates atomically and allow only one active installer/check for the same consumer/assigned desktop. Do not overwrite an active unrelated workflow. The frontend can use existing project exclusivity conventions; a new coordination service is not required.

On resume:

1. Validate format, consumer root, selected release and relevant current input fingerprints. Reassess affected stages on change; do not silently reuse a prior PASS.
2. Reconcile the active dispatch. Follow a still-valid handle or validate a terminal result for that exact attempt. An unknown dispatch outcome or lost handle is not permission to relaunch; establish terminal state through existing caller mechanisms or use HITL/BLOCKED.
3. For a pending correction, inspect actual postconditions before deciding whether it already occurred. For pending HITL, verify the supplied action/authorization and its scope before restricted effects.
4. Allocate a fresh attempt for the affected check after authorized changes. Keep historical sidecars intact. Reuse only unaffected evidence that still establishes its property.
5. Continue the recorded stage and complete the adoption assessment. A stored completed stage alone is not current readiness evidence.

Use the existing execution-follow helper's signature, one-dispatch and terminal-evidence rules. Its execution-cell storage is not itself durable adoption persistence; the checkpoint supplies that small responsibility. Checkpoint flags and authorization references never create permission.

## 10. Evidence and result separation

Keep three distinct scopes: synthetic platform self-check evidence, actual consumer readiness evidence, and product proof evidence/results. Use different execution identities/output destinations so collection cannot mix them. Existing sidecars carry the execution/environment/worker/sequence and confined evidence digests.

Readiness summary and adoption assessment are bounded reports, not parallel proof contracts. They reference existing detailed records. Do not put outcomes or lifecycle state into normative product plans/bindings.

ENVIRONMENT READY is not Product PASS. Existing reporter/reconciliation behavior stays unchanged: READY without mandatory product proof does not create proved claims, and the current product result is INCONCLUSIVE in that case. The readiness adapter must not reinterpret `invokePlaywright`'s product acceptance exit as readiness success, weaken `validateCoverage`, or write a fake passing product result. Synthetic self-check evidence must never satisfy a consumer readiness or product claim.

## 11. Ownership, authorization and browser state

Only the supported WSL Node/Playwright → Windows headed Chrome/PowerShell/UIA topology is used. Obtain known host escalation through the caller's existing authorization/HITL path before restricted invocation. Preserve the exact configured browser, profile and runtime identity; no fallback browser, implicit account/site/profile, dependency installation during verification, or hidden retry is permitted.

Use exclusive assigned access, one worker, no full parallelism and zero retries. Existing plan/assignment effect restrictions remain authoritative. Reusing an exact unique existing target does not authorize reload/navigation. Creating a missing page requires `target-create` and `target-navigate` in the relevant normative claims and assignment plus literal `target` disposable ownership. Installation permission alone does not confer these effects.

Browser/profile/reused pages are borrowed. Preserve all observable browser state, including created pages and partial setup effects, after success/failure/remediation. Normal proof/readiness completion uses no browser-target cleanup. Dispose temporary verifier connections and owned relays through existing lifecycles; finish the worker normally. Browser-state cleanup/reset or a CLOSED baseline requires an explicitly authorized lifecycle action, never automatic probe teardown. HITL resume does not imply cleanup authorization.

Hooks remain trusted deterministic observation-only project code, not a sandbox or a setup engine. Deadline/cancellation/result checks are reused without claiming isolation of arbitrary code. Consumer fixture setup/teardown effects must also fit the authorized readiness scope.

## 12. Fresh installation and upgrade

Both use the same converge-to-ready process. Fresh installation begins with more missing integration. Upgrade compares the selected release's contracts against actual existing integration and changes only demonstrated gaps. Preserve valid consumer customizations, completed project history, approval authority and proof artifacts.

Published release content remains immutable. Repair an incomplete installation by restoring matching published bytes; do not patch the indexed runtime in place. An explicitly authorized upgrade changes the release selection. Changed release/integration identity invalidates affected checkpoint conclusions/evidence. Do not perform retroactive product verification or consumer product changes as an adoption side effect.

## 13. Packaging requirements

Ship the bounded frontend entry, complete workflow instructions, checkpoint/resume guidance, deterministic smoke extension, indexed canary/synthetic support, readiness adapter/probe assets and a minimal configuration-composition example with the same release identity as existing contracts/runtime/frontends.

Use existing public `/resources`, `/validation`, `/runtime`, `/compilation` and `/invocation` entry boundaries. Add the readiness function alongside invocation support; do not create an independently versioned package/service. Package instructions must identify explicit inputs, normal commands, installed distribution paths, expected outputs, prerequisites, authorization boundaries and remediation/HITL behavior. An AI installer must not need a development checkout, external personal skill path or knowledge reconstructed from this implementation discussion.

Update the maintained build copy/assembly/resource inventory for every new executable asset and its dependencies. Index exact bytes and preserve relocation. Existing assembly explicitly selects shipped fixture files and excludes source test suites; repository presence alone does not ship a canary/probe/example. Include installed consumer-facing instructions without shipping consumer artifacts, secrets, observations, checkpoint or generated run output. The architecture document is the canonical source design; distribute the operational instructions necessary to execute it through the frontend/install documentation.

## 14. Invariants

- Installation-only success never establishes adoption PASS.
- Hook absence never establishes HookNotRequired; real hooks remain optional and consumer-owned.
- Self-check uses installed code, isolated synthetic inputs and no live browser.
- Consumer readiness uses actual configured fixture/runner/host/target; a canary cannot substitute.
- Each preflight sequence has one project stage; no chaining or confinement relaxation.
- Probe source/configuration and evidence belong to the current explicit attempt.
- READY plus normal completion is necessary but applicable prerequisite coverage is also required.
- Product coverage, evidence, verdict reconciliation and Human Acceptance remain unchanged.
- Corrections are diagnosed, narrow, authorized and recorded; unchanged failures are not retried.
- Resume never silently relaunches an uncertain active operation.
- Valid integration and immutable published platform bytes are preserved.
- Observable browser state survives checks and failures; cleanup/reset remains an explicit lifecycle action.

## 15. Concrete implementation handoff

The following are implementation destinations/reuse boundaries, not changes made by this document. The approved four responsibilities remain the scope; local module factoring is an implementation detail.

| Responsibility | Current modules and bounded work |
| --- | --- |
| Installation frontend | Extend [orchestrator installation guidance](../../frontends/verification-orchestrator/SKILL.md#installationadoption-guidance) into a callable bounded installation/adoption entry; keep explicit-plan product execution separate. Update [distribution instructions](../../distribution/README.md) with the packaged procedure. Use existing consumer installation/agent configuration conventions; no registry or autonomous permission grant. |
| Integrity/input validation | Reuse [resource resolver](../../src/resources/resolve.ts), [plan validator](../../src/validation/plan.ts) and [provider discovery/typecheck](../../src/compilation/bundle.ts). Keep exact binding/resource/version/effect checks. Do not invoke product generation/coverage merely to prove setup. |
| Checkpoint | Add small frontend-owned read/write/validation support for section 9. Reuse [follow-execution](../../frontends/browser-verification/assets/follow-execution.cjs) rules for active handles; do not treat in-memory storage as durable. No generic journal/state machine or new product schema is needed. |
| Installed self-check | Extend [distribution smoke](../../distribution/smoke.mjs), factoring the installed canary/synthetic fixture so smoke and source tests exercise the same implementation. Reuse [hook regression patterns](../../tests/runtime/preflight.test.mjs) and actual [projectPreflight](../../runtime/preflight.ts). Use existing readiness collection/evidence checks; do not mock the hook function itself. |
| Readiness invocation/report | Add a narrow readiness function alongside [invokePlaywright](../../runtime/invoke.ts), reusing its explicit runner, source identity and one-worker/zero-retry behavior. Keep its product path and acceptance exit unchanged. Select only the probe and emit section 6's readiness summary. |
| Fixture bridge | Minimally extend [fixture configuration/assignedPage boundary](../../runtime/fixtures.ts) and [preflight option types](../../runtime/preflight.ts) for readiness-only setup selection. Preserve normal product manifest validation. Reuse the same browser/project/target/gate functions and teardown; avoid copying stage logic or building a substitute fixture that hides consumer composition. |
| Readiness evidence | Reuse [recorder/collection/order validation](../../runtime/evidence/readiness.ts) and [preflight schema](../../schemas/preflight.schema.json). Add only summary collection needed by the adapter; leave blocker-to-product-claim conversion and product reconciliation unchanged. |
| Configuration example | Extend or complement [ordinary configuration example](../../examples/playwright.config.ts) and [composed fixture example](../../examples/verification-fixtures.ts) for bounded readiness selection. Document explicitly required custom readiness fixtures; no universal consumer hook or application setup. |
| Packaging | Update [asset copying](../../distribution/copy-assets.mjs), [assembly](../../distribution/package-set.mjs), [resource inventory](../../src/resources/inventory.ts) and public exports in [package configuration](../../package.json) only as needed for the new entry/assets. Installed imports must resolve through the matching distribution. |

Current implementation constraints to resolve in the adapter are explicit: `preflightRecorder` requires current plan/assignment/manifest identities, `assignedPage` requires mapped proof test keys, and `invokePlaywright` requires product coverage and uses product acceptance. The readiness-specific selection/report bridge is the approved missing adapter. These constraints are not direct contradictions with this design, and must not be removed from ordinary product execution.

Do not change [product reporter](../../runtime/reporter.ts), [reconciliation](../../runtime/evidence/reconcile.ts), product serialized contracts or capability behavior to make adoption pass. If implementation discovers a direct contradiction requiring a different architectural boundary, record it and stop for the design owner; do not silently redesign. No architectural question is intentionally left to the implementation task by this handoff.

## 16. Focused deterministic test obligations

Future implementation verification is closed-scope and requires no Chrome, live acceptance or consumer repository changes. Use temporary projects, installed/relocated candidates and controlled synthetic host/browser objects.

1. **Completion contract:** installation/integrity alone, self-check alone, or READY without normal completion/applicable prerequisite coverage cannot establish adoption PASS. Reuse [adoption static tests](../../tests/contracts/adoption.test.mjs).
2. **Hook decision:** Required, NotRequired and Unresolved follow source/configuration assessment; absence alone is insufficient; valid existing hooks survive install/upgrade; a canary cannot satisfy Required.
3. **Installed self-check:** relocated installed code actually imports/invokes the indexed confined canary, delivers context/input, records fresh digest-valid evidence and finishes. Relevant mutated/missing/version-mismatched canary/evidence is rejected. No host/browser process is invoked.
4. **Actual fixture path:** a temporary consumer-composed fixture and runner configuration are used by the probe. Existing [automatic-gate synthetic fixture](../../tests/fixtures/preflight.spec.ts) supplies a pattern. Unmapped/wrong environment/identity/configuration or substitute fixture cannot obtain readiness success. Probe selection does not execute product bodies.
5. **Readiness isolation:** required hook and deliberate no-hook stages reach the gate through shared functions; NEEDS_HITL/BLOCKED stops setup. Valid sidecars plus successful terminal runner/disposal are required; absent/stale/corrupt evidence or interrupted completion cannot pass. Reuse [preflight tests](../../tests/runtime/preflight.test.mjs).
6. **Product semantics:** no proved product claim/result is emitted by a readiness check. Preserve the existing [READY-only INCONCLUSIVE regression](../../tests/runtime/selection-readiness.test.mjs), product manifest validation and mandatory evidence reconciliation.
7. **Repair:** one known authorized correction produces a fresh affected attempt; repeated unchanged failures, uncertainty, missing authorization and product-decision changes lead to HITL/BLOCKED. No permission broadening, hidden retry or persistent setup is introduced.
8. **Resume:** atomic checkpoint, input freshness, dispatch-before-effects, preserved active handle, terminal identity matching and correction interruption prevent duplicate execution/repair. HITL continuation revalidates action/authorization and uses fresh affected evidence. Unknown format/root/release cannot silently resume.
9. **Preservation/upgrade:** valid consumer wiring is unchanged, only demonstrated gaps are corrected, release bytes remain immutable and product artifacts remain separate. Synthetic browser state/created pages survive successful and blocked probes; temporary owned resources finish disposal.
10. **Distribution:** all new operational assets/instructions are indexed and relocatable, source-only tests/examples are not assumed available, required entries import/typecheck, and assembly/integrity/reproducibility checks retain their existing behavior. Reuse [distribution regression](../../tests/contracts/distribution.test.mjs).

Add tests only for these distinct contract/adapter properties. No scenario-specific browser tests, exploratory acceptance expansion or repetitive tests mirroring trivial implementation are required by this design.
