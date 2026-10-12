# Installation / Adoption Workflow

Status: canonical approved Installation / Adoption design, including the installer-owned consumer-integration model below. The current repository supplies checkpoint/HITL guards, the installed hook self-check, the shared readiness fixture and the invocation/report adapter. Unconditional integration regeneration and the installer-generated readiness entry are approved for later implementation; they are not implemented or published by this documentation change. Existing packaged installation/integration instructions still contain preservation and one-correction policies; section 15 identifies the consistency changes required before operational delivery. Selected published release authorities remain authoritative for executing that release.

## 1. Purpose and scope

Make AI-driven installation, upgrade and recovery converge a consumer repository to an operational Verifier installation. Installing release files, selecting a binding, passing integrity checks, or installing frontend skills/agents establishes platform installation only. Successful adoption also requires demonstrated consumer operational readiness for the applicable Verifier workflow.

Platform defines WHAT consumer integration must satisfy; the AI installer determines HOW to realize it in the current native consumer project. The workflow follows the selected immutable release's current packaged contract and existing project authorization. The installer inspects only native sources needed to realize and validate those explicit requirements; it must not expand requirements through open-ended interpretation of consumer plans, architecture, code or obligations. Native consumer code and configuration are the source of truth for consumer semantics. Previous installer-generated Verifier integration is output, not consumer architecture or requirement authority. The workflow stops before product proof and performs no consumer product acceptance.

This design formalizes the [installation/adoption instructions](../../distribution/README.md#installation-and-consumer-adoption), [Verification Integration Contract](../../contracts/verification-integration.md), and [public preflight contracts](../../contracts/contracts.md#preflight-contracts). Implementation must reuse those boundaries.

## 2. Architectural boundaries and non-goals

The workflow belongs to the installation-facing frontend. AI follows the current packaged Platform integration requirements, inspects the current native consumer sources needed to realize them, and regenerates authorized integration under `.verification/integration/`. It may generate runners, fixtures, adapters, wrappers, bridges, provider/invocation wiring, readiness wiring and an optional ProjectPreflightHook; it may adapt module formats, loaders, runner/config shapes, fixture shapes and invocation interfaces. Additional technical bridges remain installer work when direct integration is incompatible. Deterministic Platform helpers validate inputs, invoke the generated readiness boundary and collect evidence. Runtime does not interpret arbitrary consumer module semantics or make AI decisions.

There are only four workflow responsibilities:

1. A packaged installation/adoption frontend or bounded entry in the existing frontend.
2. A small consumer-local adoption checkpoint.
3. A deterministic installed-platform hook self-check extending the shipped smoke.
4. A narrow readiness-only invocation/report adapter using the actual consumer execution path.

These are responsibilities, not four mandatory subsystems. Reuse the existing orchestrator, self-check, `invokeReadiness`, readiness selection, shared fixture and evidence/report helpers. Directory ownership is sufficient: no ownership manifest, generated-file provenance registry, migration framework, adapter DSL, new orchestration framework, new readiness layer, Platform-side module emulation or fallback runner architecture is authorized. No consumer-specific compatibility logic belongs in Platform code. No changes to native consumer/product semantics, generic capability semantics, driver topology or product verdict reconciliation are part of this design.

The existing nullable `pendingHITL`, resolution, continuation, checkpoint persistence and durable cancellation model remains unchanged. It adds no HITL schema, runtime-fact checklist, field-by-field installer state machine or queue of unresolved conditions. BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY remains unchanged.

The AI installation frontend owns interpretation of authoritative sources, bounded discovery, derivation, deciding whether an issue is genuinely user-owned, constructing viable options, ordering issues, implementing approved installer-owned work and verifying postconditions. Deterministic helpers enforce structural/state invariants and validate concrete configuration, identity and evidence. They do not decide which question to ask or which repair to perform. Runtime validators must not become an interaction planner or remediation engine.

### Integration ownership and authority

For MVP, ALL files created exclusively for Verification Platform consumer integration live under `.verification/integration/`. Everything under `.verification/integration/**` is installer-owned generated output, including readiness entrypoints/probes, runners, fixtures, adapters, wrappers, bridges, provider implementations/declarations and invocation wiring, the optional ProjectPreflightHook, and auxiliary code/configuration emitted by those adapters. A generated adapter must not create integration code in another namespace or present it as native consumer code. References to native code do not transfer ownership of that code.

On every install, upgrade and recovery, regenerate the required integration from the CURRENT Platform contract for the selected release and the CURRENT native consumer project. Existing directory contents have no preservation authority: they may be overwritten or recreated without preserving their previous implementation. Do not infer consumer requirements from them or carry them forward merely because they exist. Reassess hook necessity and technical wiring from the current authoritative inputs. Regeneration may yield identical bytes; the requirement is fresh derivation, not mandatory byte differences.

| Location/source | Ownership and lifecycle |
| --- | --- |
| Native consumer code, configuration and governing product requirements | Consumer semantic authority. Preserve behavior, required setup and existing authorization; generated wiring adapts to these sources. |
| `.verification/platform/` | Installed Platform release/candidate bytes. Indexed bytes are immutable; installation repair/selection follows existing integrity rules. A candidate is not publication or adoption PASS. |
| `.verification/integration/` | Disposable, regenerable installer output. This directory alone defines integration ownership; no ownership registry is needed. |
| `.verification/platform.json` | Existing neutral binding, separate from generated integration and readiness hook references. |
| `.verification/adoption.json` | Workflow/checkpoint state. Preserve lock/CAS, pending decisions, durable cancellation and active-dispatch reconciliation. |
| `.verification/adoption-evidence/` | Retained observations, diagnosis, source/configuration identities, attempt reports and provenance. Keep historical evidence when integration is regenerated; revalidate its applicability. |
| Existing approvals and frontend/agent installation configuration | Retain their current authorization and installation lifecycles. Integration regeneration does not replace approval authority or delete installation configuration. |

Regeneration grants no authority to delete checkpoint state, approvals, evidence, installed Platform bytes or native files. Use existing realpath confinement to keep writes inside the owned directory; a path/symlink escaping it is not an ownership grant. Native configuration may reference generated entries through the existing authorized configuration workflow without changing native semantics. No migration or cleanup of earlier integration layouts is part of this design.

## 3. Final workflow and stage semantics

```text
INSTALL / UPGRADE
  → CONFIGURE CONSUMER
  → PLATFORM SELF-CHECK
  → CONSUMER READINESS PROBE
  → ADOPTION ASSESSMENT
  → PASS

Technical mismatch → diagnose → adapt/wrap/bridge/rewire/regenerate → validate → fresh affected check → continue
User-owned decision/authorization/external action required → persist one HITL → emit HITL only → wait
Genuine inability to satisfy contract → record cause/evidence and BLOCKED
Approved resolution → persist decision → implement/verify → validate → reassess → continue
Explicit user cancellation → CANCELLED
```

| Stage | Required work and completion boundary |
| --- | --- |
| INSTALL / UPGRADE | Install the explicitly selected published release through existing installation conventions. Prepare locked dependencies explicitly. Validate binding, index identity, indexed resources and complete execution integrity. Configure matching frontend/agent paths through the consumer's normal configuration workflow. Do not select an unpinned latest version. |
| CONFIGURE CONSUMER | On install, upgrade and recovery, regenerate required wiring under `.verification/integration/` from the current Platform contract and current native consumer sources. Preserve native semantics, not the previous generated implementation. Autonomously create the adapters/bridges needed for technical compatibility. Establish the hook decision and validate a ready-to-invoke readiness entry. Planned references alone are insufficient. |
| PLATFORM SELF-CHECK | Run the installed deterministic smoke, including the isolated hook mechanism check in section 5. Completion requires successful installed-code execution and valid self-check evidence. |
| CONSUMER READINESS PROBE | Invoke the installer-generated readiness entry through the existing invocation boundary. Its generated fixture/runner/adapters reach the actual native environment and execute setup only. Establish current BrowserPreflight, project stage, TargetPreflight and ENVIRONMENT READY; finish the worker and temporary-resource teardown normally. |
| ADOPTION ASSESSMENT | Match the demonstrated configuration/readiness to all applicable consumer prerequisites. Confirm callable required integration, evidence validity and normal probe completion. Identify any custom fixture, provider/native readiness, authorization or human prerequisite not established by the shared gate. |
| PASS | All conditions in section 7 hold for the selected release and current consumer inputs. Record completion and evidence references. |

Execute each applicable assigned environment/target serially. Do not assume one gate proves different configurations, or add unrelated environments or scenarios. Existing valid evidence may be reused only for the properties and identities it still establishes.

## 4. Hook decision contract

The installer records one of three explicit decisions scoped to the packaged platform integration requirements and the consumer environment/configuration information needed to realize and validate them:

| Decision | Meaning and action |
| --- | --- |
| HookRequired | Deterministic project-specific readiness conditions required by the current Platform contract are not established by the shared stages or other current valid coverage. Generate the necessary hook under `.verification/integration/` and reference it from generated runner/fixture wiring. |
| HookNotRequired | Readiness conditions required by the packaged platform integration requirements are covered without a project hook. Record the source-backed rationale; the runtime's deliberate no-hook project stage is valid. |
| Unresolved | Required governing sources are missing/contradictory or readiness behavior depends on a genuine unresolved user-owned decision. Do not infer HookNotRequired or manufacture a hook. Seek authoritative resolution autonomously first; use HITL only for the residual user-owned issue, or record demonstrated contract inability. Technical hook implementation choices alone are not Unresolved/HITL. |

Determine HookRequired / HookNotRequired / Unresolved from the packaged platform integration requirements plus only the consumer information needed to realize and validate those requirements. Feature plans, product claims, assignments and obligations do not themselves define the hook requirement; consult them only when explicitly needed as consumer evidence for the platform-defined integration. Do not derive new readiness requirements through open-ended consumer inspection. Hook absence is not evidence for HookNotRequired. A platform canary is not evidence about this decision.

Derive hook necessity and observed conditions from the current Platform contract and current native consumer evidence on every regeneration. An old generated hook has no preservation or requirement authority. Replace it, or omit it when the fresh assessment establishes HookNotRequired; do not omit a required readiness condition merely to obtain READY. Reconcile the generated configuration and hook decision before invocation. Record the rationale and current input fingerprint; re-evaluate on changes to its authoritative sources or configuration.

The hook remains deterministic consumer-side integration code, generated under `.verification/integration/`; checking it in does not give its previous implementation preservation authority. Native consumer semantics remain consumer-owned. Use the existing contract version, relative entry, entry SHA-256, JSON input and positive deadline. Keep its reference outside `.verification/platform.json`. Hook code observes readiness and writes evidence; it does not install, enable, reload or otherwise perform persistent setup. The installer performs authorized adaptation/setup outside the hook.

## 5. Platform self-check design

Use the existing shipped deterministic smoke and installed hook self-check rather than add a live canary workflow. Exercise the actual installed `projectPreflight` and evidence implementation using a controlled synthetic browser/session. No Windows host acquisition, CDP attachment or Chrome launch is needed.

The bounded check must:

1. Verify the selected distribution and obtain the canary bytes/digest through its resource index.
2. Create an isolated scratch project root and evidence directory. Copy the exact indexed canary module into that root; do not edit the indexed distribution or any consumer hook.
3. Create a fresh self-check execution identity and recorder. Append an explicitly synthetic browser-stage record and supply controlled `isConnected`/session revalidation behavior satisfying the hook's existing preconditions. Synthetic provenance must never be presented as an actual browser observation.
4. Reference the confined canary by its relative entry, digest, supported version, bounded deadline and explicit JSON input. The canary checks delivered context/input and writes fresh evidence including the current execution/environment identity and received input. It returns READY with the actual evidence digest.
5. Call the installed `projectPreflight`, then verify its project PASS record, hook entry/input identities, canary observations and persisted evidence using existing collection/validation helpers. Complete the smoke normally and record its terminal outcome.

This proves installed hook loading, execution, context delivery, result validation and evidence persistence. It proves neither live browser acquisition nor consumer readiness. It need not call TargetPreflight or ENVIRONMENT READY. Its successful two-stage prefix is a mechanism check, not a complete consumer preflight.

The canary, synthetic support and self-check output remain independent of the actual consumer hook. Keep realpath confinement and the single project-stage ordering unchanged. No absolute external hook reference, escaping symlink, synthetic consumer READY record or hook chaining is allowed. Existing dependency/runner smoke remains part of the lightweight installed-platform check.

## 6. Consumer readiness-probe design

### One installer-generated invocation boundary

The AI installer produces ready-to-invoke integration under `.verification/integration/`. Platform invokes one explicit stable readiness entry in that directory:

```text
Platform /invocation: invokeReadiness
  → generated consumer readiness entry
  → generated fixture/runner/adapters/bridges as needed
  → actual native consumer environment/code
```

Reuse the existing `invokeReadiness(request)` boundary and `boundedProcess` rather than introduce a second invocation subsystem or readiness layer. In the later implementation, `ReadinessRequest.runnerEntry` names the generated Node-invocable readiness entry instead of the native Playwright CLI. Platform supplies the prepared readiness context through an explicit JSON input file argument; the generated entry translates it to the project's compatible loader/runner invocation. It may use the existing pinned Playwright CLI internally. This is one consumer integration entry, not an action interpreter or fallback driver.

The existing assignment's `fixtureEntry`, `runnerConfig` and installer-generated provider entries/declarations identify integration files under the owned directory; those files may reference native consumer code. Expose the existing prepared `probePath` as an explicit input identifying the installer-generated setup-only probe, rather than deriving a Platform-chosen filename. No fixed consumer module extension or native configuration shape belongs to the invocation boundary. Platform reads input bytes/identities and exchanges JSON/evidence; it does not import arbitrary native consumer runner modules to discover how they execute.

Before readiness invocation, the workflow has regenerated the entry, fixture, runner/config, probe and every compatibility bridge under the install/upgrade/recovery rule. The installer owns module-format, TS/JS, loader, runner/config, fixture and invocation adaptation, including project-specific validation/typechecking. It selects the necessary native setup and teardown without suppressing required semantics or collecting product test bodies. The generated entry preserves bounded execution, cancellation and owned child-runner finalization under existing lifecycle rules. Technical incompatibility in the first realization triggers further installer convergence, not user HITL or workflow BLOCKED by itself.

Use the exact selected runtime/profile/target and freshly assessed hook configuration. The generated fixture composes the existing shared `test`/`expect` and readiness gate through ordinary `test.extend`; adapters connect native facilities as needed. A platform-only fixture or fabricated READY record is insufficient. A regenerated conforming fixture is valid integration, not an impermissible substitute merely because it replaces previous generated wiring.

### Input and selection bridge

Reuse existing plan bytes, binding/resolution, assignment, execution identity, fixture/provider source identities and host options. Validate realized configuration, callable exports, readiness entry/probe paths and known execution effects before invocation. The owned directory remains confined after realpath resolution. The generated entry supplies current effective configuration and exercises the actual assigned environment; it grants no permissions.

Reuse current input/configuration fingerprints and source digest references to bind the selected contract, relevant native inputs and actual generated entry/probe/fixture/runner/provider/hook/bridge bytes. The entry and auxiliary integration sources must participate in freshness checks, not just the top-level fixture. These are existing identity/evidence responsibilities, not an ownership manifest or provenance registry. Store diagnosis and source references in retained evidence. Regeneration invalidates affected prior readiness conclusions when their inputs/bytes differ; identical current identity may retain still-valid evidence for the properties it proves.

Normal product execution requires a coverage manifest, an annotated mapped proof `testKey` and a complete product bundle for `invokePlaywright`. The current readiness adapter instead uses a bounded setup-selection context carrying the selected environment, existing claim IDs and a unique probe `testKey`. Preserve validation against the original plan/assignment and all existing target effect/ownership restrictions. This context selects setup authorization only; it is not a replacement product manifest or executable prerequisite language, and it does not permit fake proof mappings.

Reuse that context through the existing `PreflightOptions.readiness`, `validateReadinessSelection` and shared fixture acknowledgement. Generated wiring supplies the current identity, unique annotated probe `testKey`, selection and effective configuration to the shared fixture and existing reporter. Use one worker, `fullyParallel:false`, zero retries and exclusive assignment. Normal product execution retains its manifest, coverage, source and annotation requirements; a readiness invocation cannot bypass them. Where a current manifest exists, use it as source context without changing its product obligations. Readiness does not require generating a product-proof bundle merely to run setup.

Platform retains checks of assigned host/target, current identities, fixture receipt, exactly one selected setup probe, effective configuration, evidence and runner completion. The generated integration owns configuration composition and preserves required native setup/effects. Unsupported direct composition calls for installer adapters/bridges, not Platform-side emulation or removal of required native behavior.

### Current machinery to change

Current `invokeReadiness` generates `probe.spec.ts` and `probe.config.ts` in the attempt output, imports the native runner through that overlay, uses `composeReadinessConfig` to reshape it, runs a fixed NodeNext typecheck and invokes a Playwright CLI directly. This implements HOW inside Platform runtime and is the boundary to replace.

Remove Platform generation of executable probe/config source, its fixed filename/extension/testMatch assumptions, generic native runner merging and fixed consumer typecheck recipe. Consumer composition moves into regenerated integration. Remove `composeReadinessConfig`'s arbitrary consumer config overlay role/export; retain or extract only its existing generic assignment/selection, fingerprint and effective-evidence checks. Update the reporter to bind to the explicit generated probe identity rather than a Platform-chosen output filename. Do not restore the rolled-back `.mjs`/`.mts` symptom fixes or add further module-format branches.

Keep prepared request JSON, effective configuration evidence, records and summary in the retained attempt output under `.verification/adoption-evidence/`, using the existing assigned output directory and fresh execution-id/attempt convention. Executable integration sources stay in `.verification/integration/`. Regeneration cannot delete previous attempt evidence or replace sources during an active readiness execution; reconcile that execution first.

### Execution and completion

The existing stages execute in order:

```text
BrowserPreflight
  → freshly generated required ProjectPreflightHook, or explicit no-hook stage
  → TargetPreflight
  → flushed ENVIRONMENT READY
  → setup-only probe returns
  → ordinary fixture teardown / temporary-resource disposal
```

Validate current sidecars, identity, order, target/browser continuity, hook evidence when present, normal runner completion, and relevant disposal diagnostics. A printed READY line or zero runner exit without adequate records is insufficient. A crashed worker after READY has not completed the probe normally.

The existing `ReadinessReporter`/summary and preflight collection remain the completion boundary, with source binding adjusted as above. Validate the actual runner's terminal status/exit as well as the generated entry process; a wrapper cannot manufacture normal completion. The adapter returns execution identity, effective configuration fingerprint, check outcome/reason, runner status/exit and evidence references. Use a readiness-specific retained output location; do not write a product `Result`, calculate product acceptance or emit passing product claim records. Existing `PreflightRecord` sidecars remain the detailed readiness evidence format.

The gate establishes configured browser/project/target setup only. It does not automatically initialize unrequested custom fixtures, establish every provider/native capability, prove application-specific usability or cover prerequisites omitted from configuration. Section 7 requires the assessment to close applicable gaps using existing bounded readiness/validation evidence. Missing evidence prevents PASS; the installer continues authorized technical convergence unless a genuine contract inability or user-owned prerequisite applies.

## 7. Adoption PASS, HITL and BLOCKED

Adoption PASS requires all of the following together:

- The installed published release and binding/indexed resources are valid and coherent, including matching frontend configuration.
- The installed deterministic platform self-check succeeded.
- Required installer-generated integration has been regenerated from current authorities/native sources, is confined to `.verification/integration/`, and is realized and callable for the applicable workflow.
- The hook decision is resolved and consistent with exercised configuration.
- Current consumer readiness evidence is valid and every required probe completed normally at ENVIRONMENT READY.
- All applicable readiness prerequisites are covered by the probe or other still-valid bounded evidence; none remains unresolved.

Adoption readiness remains separate from product proof and Human Acceptance.

### HITL interaction contract

A user-facing interaction must be either a normal progress/result report or the current HITL request. Never combine installation progress/results and a HITL choice in the same response. When a pending HITL must be presented, emit only the information necessary for its current decision/action, present the request, then stop and wait for the user. Detailed progress, diagnostics and evidence remain persisted and may be reported separately after the interaction is resolved. The factual explanation needed to choose an option belongs in the request; an installation-results report does not.

Each HITL concerns exactly one current unresolved user-owned decision, authorization or external human-owned action. The existing singular `pendingHITL` represents that issue. Do not bundle independent technical inputs into a questionnaire or pre-build requests for every currently missing fact. The workflow needs no queue or model of every possible unresolved condition. HITL is nonterminal and does not establish a successful check. Existing hook NEEDS_HITL observations provide action/reason information for frontend assessment, not permission or an automatically emitted user request.

Before asking about the current condition, the installer must exhaust safe and authorized resolution through current Platform authorities and native consumer sources. Derive values from authoritative configuration, discover supported current state, regenerate integration, create adapters/bridges and validate resulting configuration/state. Preserve native semantics, not prior generated wiring. Respect section 8's reconciliation rules and section 11's authorization boundaries; no speculative persistent setup or unauthorized observation is required. Only the residual user-owned issue may become HITL. Missing technical values and integration incompatibilities alone do not justify asking the user to solve them.

For a genuine user-owned issue with multiple viable outcomes, investigate the actual available options first. Present concrete outcomes the installer can implement after approval. Choices between equivalent technical adapters/bridges belong to the installer and do not create HITL. Each non-cancel option must state the chosen outcome, any material consequence relevant to that choice and that the installer will perform its technical implementation within verified authorization. Do not normally ask users to supply filesystem/executable paths, IDs, URLs, configuration filenames or equivalent values that the installer can derive, observe or create after the decision. For an owner-exclusive action, identify that owner's part and the installer's subsequent discovery/validation work instead of promising to perform the owner's action.

Persist the specific request, options, reason, scope and applicable request/authorization reference before presenting it. Wait for the user's actual decision; silence, elapsed time, denied authorization and a preselected option do not select approval or cancellation. After a non-cancel selection, persist the decision, implement the selected installer-owned work within verified authorization, validate the resulting state, reassess and continue the same adoption workflow with fresh affected evidence as required. Do not merely hand the user repair instructions and end installation.

If a required external artifact or capability genuinely does not exist and the installer cannot create it under current authority, the HITL may require a human-owned external action. Identify the specific missing prerequisite, the necessary action and its owner; wait for the user to report completion. Keep the current request pending while awaiting that report. The completion report does not establish readiness: the installer must discover and validate the resulting state itself before advancing. Do not request transcription of resulting technical details that can be discovered. For example, a missing supported browser may require the user to make one available, report completion, then let the installer discover and validate it. This is an illustration of the generic external-action contract, not browser-specific workflow logic.

Every decision, authorization or external-action HITL must include exactly one explicit installation-cancellation option labelled **Cancel Verifier installation**. Skip, Ignore, Continue partially configured and Continue without required readiness are not substitutes or valid ways to bypass required readiness. Cancellation preserves the existing durable user-decline semantics; it creates no new terminal state or permission.

Resolve conditions sequentially. After every autonomous or user-approved resolution, validate and reassess the current installation state before deciding whether another HITL is necessary. One earlier decision may determine several later technical values and eliminate further interactions. Preserve unaffected valid evidence; do not turn reassessment into unchanged retries or a fixed prerequisite checklist.

Fail-fast applies to a demonstrated genuine inability to satisfy the Platform contract or a required user-owned decision, authorization or external action. Record the cause, evidence and owner/next action. Workflow BLOCKED remains nonterminal and prevents a false adoption PASS; it is not a technical compatibility verdict. ESM/CommonJS, TS/JS, loader, runner/config, fixture and invocation mismatches, a failed first implementation or a repeated defect ID do not by themselves justify HITL or BLOCKED. The installer adapts, wraps, bridges, rewires or regenerates integration and continues within existing authority.

An actual unavailable required capability or unresolved Platform defect can establish genuine inability only when evidence shows the current contract cannot be met through authorized integration; an initial import/configuration error is insufficient. Do not fabricate capability support, weaken checks or change native product behavior. HITL is emitted only when a specific genuine user-owned issue exists. A contract inability does not require inventing a user choice. Normal BLOCKED reporting stays separate from any actual HITL request.

The only installation terminal outcomes are verified PASS and explicit user cancellation (CANCELLED). Missing/incompatible integration artifacts, technical implementation choices, NEEDS_HITL, BLOCKED and failed intermediate checks never by themselves mean "Verifier not installed". The installer owns continued technical convergence of `.verification/integration/`. Cancellation ends this workflow; it does not authorize rollback, uninstall, regeneration or browser-state cleanup. Preserve active dispatch identity/handle for finalization through existing lifecycle rules; a lost handle must not prevent recording cancellation or authorize relaunch. No further installation work is dispatched.

Individual checks retain FAIL, BLOCKED and INCONCLUSIVE as appropriate: a setup prerequisite can block that atomic check, and missing/lost/stale evidence cannot pass. These outcomes do not automatically set workflow BLOCKED or create pending HITL, and do not alter product verdict semantics. `recordAdoptionCheck` already records the outcome and clears the dispatch without changing workflow status. The frontend diagnoses and continues technical convergence under section 8, applying the fail-fast/user-owned boundary only when its conditions are actually established.

## 8. Remediation rules

Use: diagnosed technical cause → authorized adaptation/wrapper/bridge/rewiring/regeneration → validate postconditions → reassess → fresh affected check when required → continue. More than one technical realization may be needed to satisfy the same contract. Resolve the current condition before selecting another; no pre-built remediation/questionnaire sequence or generic repair engine is needed.

Changes follow the current Platform contract, preserve native consumer semantics and stay within installer-owned integration and authorized readiness setup. Existing generated integration may be replaced without preserving its implementation. The installation agent performs setup outside the hook; genuine user-owned actions and additional authorization use section 7. Restore incomplete installation only from matching release bytes; do not patch indexed runtime. A regenerated hook reference uses the actual intended generated bytes; never bless an unexplained native-code edit by changing its digest.

Record diagnosis, intended adaptation, before/after input identity and evidence using the current defect marker and retained evidence. Persist correction intent before effects. After interruption, inspect actual postconditions and reconcile any reserved/running operation before replacing integration or performing another adaptation. Do not blindly repeat effects or rename an unchanged failure to evade reconciliation.

Do not retry unchanged failures, broaden permissions, weaken checks, guess product requirements, change native product semantics or perform speculative persistent browser setup. A revised technical realization after diagnosis/postcondition validation is autonomous convergence, even when the defect ID remains the same. It must not require a user decision merely to release a one-correction allowance. The current `reserveAdoptionCorrection` same-ID rejection must change accordingly while keeping intent, evidence and reconciliation guards. Missing required authority or an external human action still requires genuine HITL; demonstrated contract inability may remain BLOCKED. No retry quota, permission expansion or new checkpoint model is introduced.

A rerun is a fresh explicit execution attempt with its own identity/output, never a hidden runner retry. Rerun only the affected check, but include its required stage dependencies. Changes to consumer configuration/hook/runtime or HITL environment actions require a fresh consumer preflight sequence. Do not append another project hook to a completed sequence, replace identity during an atomic check, or resume at target setup using stale browser/project observations. Unaffected release integrity/self-check evidence may be reused when its identity and validity remain unchanged.

## 9. Checkpoint and resume contract

Use one consumer-local `.verification/adoption.json` checkpoint, separate from `.verification/platform.json`. It is installer-owned workflow metadata, not a process approval registry. A small supported format is sufficient; no migration framework is required. Unknown formats block safe resume rather than being guessed.

| Field/responsibility | Minimum information |
| --- | --- |
| Format | Format version. |
| Consumer | Canonical consumer root identifying the repository being converged. |
| Selection | Selected repository/tag/source commit and binding/index digest, with reference to the existing binding. Version alone is insufficient. |
| Progress | Current workflow stage and its active, waiting, blocked, completed or cancelled status. Waiting/blocked are nonterminal. |
| Hook decision | HookRequired / HookNotRequired / Unresolved, short rationale/source references and relevant input fingerprint. |
| Last check | Check kind, execution identity, outcome/reason and evidence/summary reference. Keep successful applicable check references in existing assessment evidence. |
| Active dispatch | Operation/check identity, input/command fingerprint, dispatch status and handle/reference when running; null when inactive. Persist intent before dispatch. |
| Pending HITL | One nullable `pendingHITL` for the current user-owned issue: action, reason, affected scope, authorization/request reference and concrete resolution options, including Cancel Verifier installation; its presence requires waiting status. |
| Latest user resolution | Selected option, request reference and explicit user decision reference when a decision has been supplied. Retain only the latest resolution; detailed history stays in evidence. Cancellation requires this reference. |
| Current defect | Diagnosis identity/evidence reference and whether the current technical adaptation has been reserved/applied. Reconciled revised adaptations are not limited to one per defect ID. Detailed history stays in evidence. |

Detailed attempt history, observations and diagnostics stay in existing evidence artifacts. A compact adoption assessment records input identity and references to the applicable integrity, self-check, readiness and prerequisite evidence; the checkpoint points to it rather than copying it.

Write checkpoint updates atomically and allow only one active installer/check for the same consumer/assigned desktop. Do not overwrite an active unrelated workflow. The frontend can use existing project exclusivity conventions; a new coordination service is not required.

### Deterministic implementation obligations

Retain the following already implemented request/decision/checkpoint guards, without adding state or schema:

- At most one `pendingHITL` exists; its presence implies checkpoint status `waiting`, and waiting requires a pending request.
- An existing persisted pending HITL cannot be silently replaced by another request without its recorded resolution. Preserve the request while waiting; persist its matching resolution before creating any next request. Enforce this at the checkpoint writer under the existing lock and compare-and-swap, as well as through the request helper.
- A selected option must be one of the offered options, with an explicit user decision reference. Distinct option IDs, at least one concrete continuation option and exactly one installation-cancellation option remain required.
- An approved non-cancel resolution records the decision, clears the pending request and returns the same adoption workflow to continuation after existing dispatch/correction reconciliation. Continuation is not proof of successful implementation or readiness; section 7 still requires implementation/verification, validation and reassessment.
- Durable cancellation remains terminal, including if a caller clears its latest resolution or supplies a newly created active checkpoint to the same persisted workflow. Preserve active dispatch identity for lifecycle finalization; do not dispatch further installation work.
- At the user-facing interaction boundary: pending HITL → emit HITL only → return and wait; otherwise → normal report. The HITL branch must not fall through to normal reporting.

The last obligation belongs at the AI/caller's actual interaction emission boundary. Checkpoint and runtime helpers cannot prohibit separately generated prose. No new report schema, renderer subsystem or runtime interaction engine is required. The semantic quality of one issue and its options remains the frontend responsibility specified in sections 2 and 7.

On resume:

1. Validate format, consumer root, selected release and relevant current input fingerprints. Reassess affected stages on change; do not silently reuse a prior PASS.
2. Reconcile the active dispatch. Follow a still-valid handle or validate a terminal result for that exact attempt. An unknown dispatch outcome or lost handle is not permission to relaunch or regenerate code used by that operation. Establish terminal state through existing caller mechanisms. Existing safe-resume BLOCKED guards remain until the effects can be reconciled; this is a lifecycle safety boundary, not escalation of a technical integration mismatch. HITL still requires a specific user-owned issue.
3. For a pending correction, inspect actual postconditions before deciding whether it already occurred. For pending HITL, emit only the recorded current request/options, including Cancel Verifier installation, then return and wait for an explicit decision or the requested external-action completion report. Record the resolution through the existing helper and persist it before implementing approved installer-owned work. Verify supplied authorization and its scope before restricted effects; discover and validate an external action's result yourself. A lost dispatch requires reconciliation, never implicit cancellation or an invented user decision.
4. On recovery, after reconciling active operations and pending user decisions, regenerate required integration from the current selected contract and current native consumer sources. Old generated files and a completed configuration stage cannot waive this rule. Preserve retained evidence and checkpoint/approval state. A cancelled workflow cannot regenerate; a genuinely required pending user action must be resolved before dependent effects.
5. Validate postconditions and reassess current input identities. Invalidate affected conclusions when integration/native/contract inputs change and allocate fresh affected checks when needed; keep historical sidecars intact. Regeneration that yields identical current bytes may reuse evidence only for properties/identities it still establishes.
6. Continue and complete the adoption assessment. An ordinary follow/poll of the same active execution is not another recovery or regeneration trigger. Do not replace its integration mid-attempt. Determine whether another genuine user-owned issue needs HITL only after validation/reassessment. A stored completed stage or `adoptionResumeAction === 'complete'` is not permission to skip regeneration on a new install, upgrade or recovery.

Do not resume a cancelled workflow or dispatch further corrections/checks from it. Existing checkpoint helpers record the pending options and latest resolution; they do not grant permission, choose an option or execute remediation. No checkpoint migration or new orchestration mechanism is required.

Use the existing execution-follow helper's signature, one-dispatch and terminal-evidence rules. Its execution-cell storage is not itself durable adoption persistence; the checkpoint supplies that small responsibility. Checkpoint flags and authorization references never create permission.

## 10. Evidence and result separation

Keep three distinct scopes: synthetic platform self-check evidence, actual consumer readiness evidence, and product proof evidence/results. Use different execution identities/output destinations so collection cannot mix them. Existing sidecars carry the execution/environment/worker/sequence and confined evidence digests.

Readiness summary and adoption assessment are bounded reports, not parallel proof contracts. They reference existing detailed records. Do not put outcomes or lifecycle state into normative product plans/bindings.

Persisting these reports and diagnostics does not authorize mixing them into a user-facing HITL response. Apply section 7's report-or-HITL rule at presentation; detailed reports may be presented separately after resolution.

ENVIRONMENT READY is not Product PASS. Existing reporter/reconciliation behavior stays unchanged: READY without mandatory product proof does not create proved claims, and the current product result is INCONCLUSIVE in that case. The readiness adapter must not reinterpret `invokePlaywright`'s product acceptance exit as readiness success, weaken `validateCoverage`, or write a fake passing product result. Synthetic self-check evidence must never satisfy a consumer readiness or product claim.

## 11. Ownership, authorization and browser state

Only the supported WSL Node/Playwright → Windows headed Chrome/PowerShell/UIA topology is used. Obtain known host escalation through the caller's existing authorization/HITL path before restricted invocation. Preserve the exact configured browser, profile and runtime identity; no fallback browser, implicit account/site/profile, dependency installation during verification, or hidden retry is permitted.

Use exclusive assigned access, one worker, no full parallelism and zero retries. Existing plan/assignment effect restrictions remain authoritative. Reusing an exact unique existing target does not authorize reload/navigation. Creating a missing page requires `target-create` and `target-navigate` in the relevant normative claims and assignment plus literal `target` disposable ownership. Installation permission alone does not confer these effects.

Browser/profile/reused pages are borrowed. Preserve all observable browser state, including created pages and partial setup effects, after success/failure/remediation. Normal proof/readiness completion uses no browser-target cleanup. Dispose temporary verifier connections and owned relays through existing lifecycles; finish the worker normally. Browser-state cleanup/reset or a CLOSED baseline requires an explicitly authorized lifecycle action, never automatic probe teardown. HITL resume does not imply cleanup authorization.

Hooks remain trusted deterministic observation-only project code, not a sandbox or a setup engine. The installation agent performs required authorized setup/remediation outside the hook to make its observed conditions true. Deadline/cancellation/result checks are reused without claiming isolation of arbitrary code. Consumer fixture setup/teardown effects must also fit the authorized readiness scope.

## 12. Installation, upgrade and recovery regeneration

Every install, upgrade and recovery uses the same regeneration rule. Re-read the current contract for the explicitly selected Platform and current native consumer project, regenerate all required integration under `.verification/integration/`, and validate the ready-to-invoke boundary. Do not preserve/reuse the previous generated implementation because it exists, appeared valid or passed an earlier attempt. Do not derive requirements from it. Preserve native consumer customizations/behavior, project history, approval authority and retained proof/evidence artifacts.

Published release content remains immutable. Repair incomplete installation by restoring matching bytes; do not patch indexed runtime. An explicitly authorized upgrade changes release selection, not an unpinned latest lookup. Regeneration preserves `.verification/platform/`, `.verification/platform.json`, `.verification/adoption.json`, approvals and `.verification/adoption-evidence/` under their existing distinct lifecycles. Reconcile in-flight effects before replacing integration; changed release/native/integration identity invalidates affected conclusions, not historical evidence files. No old-layout migration framework, retroactive product verification or native product changes are part of adoption.

## 13. Packaging requirements

Ship the bounded frontend entry, complete ownership/regeneration/convergence instructions, checkpoint/resume guidance, existing deterministic smoke/canary and generic readiness invocation/report support with the same release identity as existing contracts/runtime/frontends. Consumer executable probes/configuration/adapters are installer output, not Platform-generated overlays or mandatory shipped consumer-specific templates.

Use existing public `/resources`, `/validation`, `/runtime`, `/compilation` and `/invocation` entry boundaries, including the current readiness export alongside invocation support; do not create an independently versioned package/service. Package instructions must identify explicit inputs, normal commands, installed distribution paths, expected outputs, prerequisites, authorization boundaries and remediation/HITL behavior. An AI installer must not need a development checkout, external personal skill path or knowledge reconstructed from this implementation discussion.

Update the maintained build copy/assembly/resource inventory for every new executable asset and its dependencies. Index exact bytes and preserve relocation. Existing assembly explicitly selects shipped fixture files and excludes source test suites; repository presence alone does not ship a canary/probe/example. Include installed consumer-facing instructions without shipping consumer artifacts, secrets, observations, checkpoint or generated run output. The architecture document is the canonical source design; distribute the operational instructions necessary to execute it through the frontend/install documentation.

## 14. Invariants

- Installation-only success never establishes adoption PASS.
- Only verified PASS or explicit user cancellation terminates installation; every user resolution request includes concrete viable continuation options and exactly one Cancel Verifier installation option.
- Each user-facing interaction is a normal report or the current HITL request; the HITL branch emits only necessary decision/action context, then returns and waits.
- Each HITL concerns one current user-owned issue after safe authorized autonomous resolution paths have been exhausted; missing technical values alone do not justify a questionnaire.
- Options express investigated outcomes and material consequences; the installer implements approved work and discovers/validates external-action results.
- Validate and reassess after each resolution before constructing another request; no runtime-fact checklist, issue queue or field-by-field state machine is introduced.
- The singular pendingHITL implies waiting status and cannot be silently replaced without recorded resolution; only offered options may be selected.
- Non-cancel resolution continues the same adoption workflow; persisted cancellation remains terminal.
- Platform defines required integration; current native consumer sources define consumer semantics. Previous generated integration defines neither.
- All integration-only files, including auxiliary code emitted by adapters, live under `.verification/integration/` and are installer-owned generated output.
- Every install, upgrade and recovery freshly regenerates required integration; old generated contents have no preservation authority.
- Hook absence never establishes HookNotRequired; required hooks are regenerated in the owned directory and remain optional/observation-only.
- Self-check uses installed code, isolated synthetic inputs and no live browser.
- Consumer readiness invokes the stable generated entry and conforming generated fixture/runner against the actual native environment/host/target; a canary cannot substitute.
- Each preflight sequence has one project stage; no chaining or confinement relaxation.
- Probe source/configuration and evidence belong to the current explicit attempt.
- READY plus normal completion is necessary but applicable prerequisite coverage is also required.
- Product coverage, evidence, verdict reconciliation and Human Acceptance remain unchanged.
- Technical incompatibility is installer work, not by itself HITL/BLOCKED; revised diagnosed adaptations continue without a one-correction quota. Unchanged failures are not retried.
- Resume never silently relaunches an uncertain active operation.
- Native semantics, installed Platform bytes, checkpoint/approval state and retained evidence survive integration regeneration; generated integration itself need not survive.
- Observable browser state survives checks and failures; cleanup/reset remains an explicit lifecycle action.

## 15. Concrete implementation handoff

This is a later implementation task, not work performed by this document. The smallest scope is the existing installation instructions/contracts, the readiness invocation/composition boundary, correction reservation policy and focused tests. Keep the shared preflight architecture and existing checkpoint/HITL model. No ownership manifest, migration subsystem or new generic adapter contract is needed.

### Grounding in current implementation

- [`ReadinessRequest`/`PreparedReadiness`, `invokeReadiness`, `composeReadinessConfig` and `ReadinessReporter`](../../runtime/adoption-readiness.ts) currently generate/compose consumer execution source and validate its outcome. Reuse the invocation, identity, receipt and report primitives; move technical realization to the generated entry described in section 6.
- [`runtime/fixtures.ts`](../../runtime/fixtures.ts) already accepts `PreflightOptions.readiness`, validates current assignment/fixture identities, writes `readiness-fixture.json`, selects authorized claims and prevents product evidence during readiness. This is the existing integration boundary to compose, not a new readiness stage.
- [`adoption.ts`](../../frontends/verification-orchestrator/adoption.ts) already implements both waiting invariants, persisted pending-request protection, matching offered resolutions, durable cancellation, lock/CAS and active-dispatch guards. Do not reimplement those guards. `recordAdoptionCheck` already permits continuation after a failed check. Only the correction policy currently forces the same defect into HITL/BLOCKED after one reservation.
- [`Assignment`](../../src/contracts/index.ts) already carries explicit fixture/runner/provider paths, and [`discoverProviders`](../../src/compilation/bundle.ts) validates configured callable exports/declarations. Use those paths for generated integration entries; no ownership fields or product contract/schema changes are needed.
- [`AdoptionAssessment`](../../frontends/verification-orchestrator/adoption.ts) already carries integration and evidence references. Use those references and readiness `sources`/fingerprints for current inputs and generated source freshness; directory ownership remains the sole ownership rule.

| Responsibility | Current modules and bounded work |
| --- | --- |
| Installation frontend | Update [orchestrator SKILL.md](../../frontends/verification-orchestrator/SKILL.md#installationadoption-guidance) and [packaged workflow](../../frontends/verification-orchestrator/assets/installation-adoption.md): regenerate on install/upgrade/recovery; create all integration-only files in the owned directory; derive requirements from current Platform authority and semantics from native sources. Allow autonomous runner/fixture/provider/readiness/hook adapters and auxiliary bridges. Replace preservation/one-correction instructions, while retaining user-owned HITL and interaction rules. Reconcile active effects before regeneration. |
| Public installation/integration authorities | Align [README](../../README.md#installation--adoption), [distribution README](../../distribution/README.md#installation-and-consumer-adoption), [Verification Integration Contract](../../contracts/verification-integration.md) and [public contracts](../../contracts/contracts.md#projectpreflighthook-consumer-authoring-contract). Replace old generated-wiring reuse/preservation authority with directory ownership and fresh regeneration. Clarify generated hook ownership versus native readiness semantics without changing hook types/effects. Keep existing planning/product authorization authorities. |
| Readiness invocation input | In [adoption-readiness.ts](../../runtime/adoption-readiness.ts), retain `invokeReadiness`; use `ReadinessRequest.runnerEntry` for the explicit generated Node entry and make prepared `probePath` explicit input. Keep assignment fixture/runner/provider references. Confine integration paths and validate bytes/identity before dispatch. Supply prepared context JSON using the existing process invocation/deadline surface; the generated entry owns loader/runner arguments and composition. |
| Consumer execution machinery | Remove `invokeReadiness`'s source writes for `probe.spec.ts`/`probe.config.ts`, fixed filenames/testMatch and fixed consumer NodeNext typecheck. Remove `composeReadinessConfig`'s native runner overlay responsibility/export; retain generic selection/assignment/configuration validation and effective evidence recording in Platform helpers. The installer-generated runner/fixture/probe/entry performs compatible native composition and project validation. No Platform module-format compatibility branches. |
| Reporter and source freshness | Adapt `PreparedReadiness`/`ReadinessReporter` to the explicit generated probe and current entry/bridge source identities. Keep one-probe/annotation validation, fixture receipt, effective configuration, four-stage records, hook evidence, no-product-record checks and normal teardown/completion requirements. Preserve the actual runner exit/status separately from entry-process failure diagnostics; wrappers cannot turn failed runner completion into PASS. Continue using `ReadinessSummary`, existing source references and `AdoptionAssessment`; do not add an ownership/provenance registry. |
| Public exports | Adjust readiness exports/types and remove the obsolete composition export in [runtime/invoke.ts](../../runtime/invoke.ts). Leave `invokePlaywright`, product coverage and acceptance unchanged. |
| Convergence/correction policy | Change `reserveAdoptionCorrection` in [adoption.ts](../../frontends/verification-orchestrator/adoption.ts) so a revised authorized adaptation of the same diagnosis can be reserved after the previous effects/postconditions are reconciled. Keep the existing reserved/applied marker, evidence and before/after fingerprints. Do not require `resolveAdoptionHITL` solely to clear a technical-correction quota; do not overwrite an unreconciled reservation. No new checkpoint format/state or retry counter. |
| Checkpoint/HITL and execution following | Retain read/write/validation, `requestAdoptionHITL`, `resolveAdoptionHITL`, `adoptionResumeAction`, `reserveAdoptionDispatch`, `recordAdoptionCheck` and [follow-execution](../../frontends/browser-verification/assets/follow-execution.cjs) lifecycle safeguards. The frontend decides whether there is a genuine user-owned issue or contract inability; check failures alone do not set workflow BLOCKED. Current input fingerprints drive reassessment after regeneration; a completed state cannot bypass it on recovery. |
| Integrity and preflight | Retain [resource resolution](../../src/resources/resolve.ts), [plan validation](../../src/validation/plan.ts), [provider discovery](../../src/compilation/bundle.ts), [shared fixture](../../runtime/fixtures.ts), [preflight](../../runtime/preflight.ts), [evidence collection](../../runtime/evidence/readiness.ts) and [preflight schema](../../schemas/preflight.schema.json). `validateReadinessSelection` remains reusable if generic checks are extracted from composition. Preserve current supported host topology, effects and source identities. |
| Self-check, transport and product | Retain [installed self-check](../../runtime/adoption-self-check.ts), [distribution smoke](../../distribution/smoke.mjs), transport instrumentation/Windows session performance fixes, [product reporter](../../runtime/reporter.ts), [reconciliation](../../runtime/evidence/reconcile.ts) and acceptance. No preflight, HITL, transport, Product Proof or release/versioning redesign. |
| Packaging | Existing [copying](../../distribution/copy-assets.mjs), [assembly](../../distribution/package-set.mjs) and [resource inventory](../../src/resources/inventory.ts) already carry these modules/instructions. Reuse them without new packages or mandatory executable assets. Installer-generated integration stays in the consumer ownership namespace and is not shipped inside Platform. Normal publication is a separate authorized operation. |

The semantic quality of discovery, native preservation, regenerated adapters and user-owned issue classification remains the AI frontend responsibility. Deterministic helpers validate concrete paths, identities, configuration, effects, evidence and lifecycle. They cannot prove exhaustive AI judgment or control arbitrary caller prose. The existing outgoing boundary remains pending HITL → HITL only → return/wait; otherwise → normal reporting.

The Node-entry/JSON-context handoff reuses current primitives and resolves the architectural boundary without defining another readiness protocol. Exact filename choices and internal adapter implementations are installer details. No genuine architectural question is intentionally deferred. If implementation discovers that a contract cannot be met without changing native semantics, authority or supported Platform behavior, record that specific contradiction rather than treating routine compatibility work as a new architecture decision.

## 16. Focused deterministic test obligations

Future implementation verification is closed-scope and requires no Chrome, live acceptance or inspection/modification of a real consumer repository. Use temporary native-project fixtures and controlled synthetic host/browser objects. Reuse still-valid self-check, preflight, HITL/checkpoint, transport and product evidence; repeat proof only where changed code affects it. This documentation task runs none of these implementation tests.

1. **Delivered contract:** update [adoption contract tests](../../tests/contracts/adoption.test.mjs) that currently require old integration reuse/project-obligation authority. Require Platform WHAT/installer HOW, current native semantic authority, the single directory scope, regeneration on install/upgrade/recovery, autonomous bridges and genuine-user-only HITL. These checks prove instruction delivery, not AI judgment.
2. **Ownership/regeneration:** in temporary projects, demonstrate fresh derivation on install, upgrade and recovery even when prior generated wiring appears valid. Old generated content may be replaced and cannot supply requirements. All generated auxiliary bridge files stay under `.verification/integration/`; native bytes/semantics, installed Platform bytes, checkpoint/approvals and retained evidence remain intact. Check the relevant confinement boundary. No ownership registry or old-layout migration is tested or built.
3. **Generated readiness entry:** adapt [adoption workflow tests](../../tests/runtime/adoption-workflow.test.mjs) to invoke an explicit generated entry/fixture/runner/probe with prepared context and real synthetic native setup. Show that Platform does not generate executable overlays or import/reshape native config. Use the existing shared fixture and [synthetic preflight pattern](../../tests/fixtures/preflight.spec.ts); no product body is selected.
4. **Technical bridging:** use bounded temporary native fixtures to establish ESM/CommonJS and TS/JS/loader compatibility through installer-generated adapters, and one representative incompatible runner/fixture/invocation composition. Check compatible execution and preserved native setup/teardown semantics, not a matrix of arbitrary loaders or platforms. All bridge code remains generated integration; no Platform-side module emulation or product change.
5. **Continued convergence:** replace the test asserting one correction forces HITL/BLOCKED. A revised authorized adaptation of the same diagnosis can continue after postconditions/reconciliation, with recorded before/after fingerprints and a fresh affected check. An unreconciled reserved operation cannot be overwritten or replayed. A failed atomic check alone does not set workflow BLOCKED. Unchanged retries and permission expansion remain prohibited.
6. **Hook decision:** freshly derived Required/NotRequired/Unresolved stays consistent with regenerated configuration. A prior generated hook creates no preservation requirement; required observed conditions are retained from current authority/native evidence. Required hooks live in the directory and stay observation-only; a canary cannot satisfy them. Reuse existing hook-shape/evidence/preflight checks instead of redesigning the hook.
7. **Identity/completion:** retain actual entry/probe/fixture/runner/provider/hook/bridge source freshness, effective assignment/selection and fixture receipt. Changed integration/native inputs invalidate affected evidence. Exactly one annotated setup probe, four ordered stages, current hook evidence and successful actual runner/temporary teardown are required. Entry exit success alone cannot hide a failed runner. Existing reports/sidecars remain the evidence formats.
8. **Recovery/lifecycle:** verify regeneration follows active-dispatch/correction reconciliation, does not replace code used by a running attempt, and cannot bypass pending user decisions or durable cancellation. A completed old configuration stage does not skip regeneration. Identical current bytes may reuse still-valid evidence; changed inputs require fresh affected proof. Keep existing checkpoint lock/CAS, active handle, terminal identity and offered-option tests.
9. **Fail-fast and HITL:** distinguish a bridgeable technical failure from demonstrated contract inability and genuine missing user authority/external action. Only the latter user-owned issue produces a request. Retain exactly one Cancel Verifier installation option, matching persisted resolution and the exclusive report-or-HITL boundary. Do not add a runtime classifier, issue queue or interaction renderer to test AI semantics.
10. **Unchanged boundaries:** reuse existing self-check, preflight, [READY-only product separation](../../tests/runtime/selection-readiness.test.mjs), transport and acceptance evidence. Only repeat distinct affected checks for readiness source/entry changes. Retain browser/profile/page preservation, temporary resource disposal and observation-only hooks without adding live browser acceptance.
11. **Packaging:** existing [distribution regressions](../../tests/contracts/distribution.test.mjs) must establish delivery of updated instructions/public exports and generic runtime modules through current assembly/indexing. Installer-generated consumer integration is excluded from Platform release content. No release/versioning work or new subsystem is implied.

Add tests only for these distinct contract/adapter properties. No scenario-specific browser tests, exploratory acceptance expansion or repetitive tests mirroring trivial implementation are required by this design.
