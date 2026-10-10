# Verification preflight design and implementation handoff

Design status: **ACCEPT WITH CHANGES**. Platform implementation status: **COMPLETE**, 2026-10-10. The design was reviewed against local `v0.2.0`, commit `17b6b391b562ee5d934c17592716e9362da7b577`; the implementation is recorded below. This status does not claim live consumer/project acceptance.

## Fit with v0.2.0

The design fits the [existing architecture](verification-platform.md): the shared runtime owns environment acquisition, the WSL → Windows host adapter owns host mechanics, caller configuration supplies identities and authorization, and ordinary Playwright/agent execution supplies product proof. Preflight is setup inside that runtime, not a service or a new executor.

| Existing boundary | Evidence in source | Required adjustment |
| --- | --- | --- |
| Configured browser acquisition | `runtime/host/wsl-windows/session.ts` calls `browser-session.py`; `browser-runtime.ps1` already implements serialized `ensure` with reuse-or-launch and exact executable/profile/listener checks | Name acquisition plus successful CDP attachment BrowserPreflight and record its outcome. Reuse the implementation. |
| Browser attachment | `runtime/fixtures.ts` acquires `hostSession`, revalidates, then calls `chromium.connectOverCDP()` | Complete BrowserPreflight before invoking the project hook. |
| Project binding/configuration | `schemas/binding.schema.json` reserves `.verification/platform.json` for immutable platform identity; `Assignment` already references caller runner/fixture configuration | Reference the optional hook from that caller configuration. Do not add executable configuration to the neutral binding. |
| Assigned page | `assignedPageReady()` in `runtime/fixtures.ts` requires exactly one existing page at `pageUrl` | Add normal reuse-or-create setup before yielding the assigned page. Retain exact selection and ambiguity rejection. |
| Readiness and proof evidence | `runtime/evidence/readiness.ts` and `runtime/reporter.ts` already map known setup blockers to unattempted claims; `Evidence` requires product claim/proof references | Add separate preflight records. Keep existing claim/result reconciliation and four verdicts. |
| Distribution | `runtime/index.ts` exports the library; `src/resources/inventory.ts` enumerates the complete distribution | Export/index the small shared preflight addition within the same platform set. |

Necessary clarifications to the agreement:

1. One fixed verification environment means one caller-configured Chrome for Testing executable/profile/debug configuration for this run. It does not mean hardcoding a personal path into the platform. Existing `launch`, authorization, effects and ownership constraints still apply.
2. Hook discovery is an explicit reference from runner/fixture configuration, not directory scanning and not a field in `.verification/platform.json`.
3. Missing targets are recoverable; ambiguous targets or an unhealthy active profile remain blocked. Creation must use the assigned persistent context and authorized effects.
4. Preflight results use a separate evidence attachment/sidecar. `ENVIRONMENT READY` and `PREFLIGHT_BLOCKED` are setup outcomes, not new product verdicts. Playwright can run fixtures while product proof remains `NOT RUN`.

## Execution location and order

```text
existing input/binding/assignment validation and caller authorization
  → BrowserPreflight
  → optional ProjectPreflightHook
  → TargetPreflight
  → ENVIRONMENT READY
  → existing Proof Executor
```

All three stages execute deterministically in the shared Node runtime in WSL. Windows operations continue through the existing Python/PowerShell adapter. No AI decides readiness during normal execution.

For ordinary Playwright, retain the worker-scoped `hostSession`/`assignedBrowser` acquisition. Run the optional hook once after that browser is attached, before any assigned page is yielded. Run TargetPreflight in the test-scoped `assignedPage` setup. Immediately before yielding that page, revalidate the current host/browser and selected target and persist `ENVIRONMENT READY`. Test body execution is the proof boundary; all project proof fixtures/actions must depend on this completed gate.

Browser/project observations can be reused within the same healthy worker attachment. Each atomic proof gets current target validation and its own gate record. A new worker reacquires runtime state and reruns setup; it does not resume a failed atomic proof. Keep one worker, `fullyParallel: false`, zero retries and the existing exclusive caller assignment.

The browser-verification frontend uses the same shared preflight exports through its supported Node/host execution path, retaining the host helper for the attachment lifetime. Its named CLI session attaches to the fresh endpoint and reacquires the selected target by observed identity. Complete and validate that executor attachment before declaring READY; an endpoint or serialized target ID is not itself a live handle. Do not run CLI mutations and ordinary tests concurrently. Model routing and interaction rules remain in the existing frontend.

## BrowserPreflight

The existing external runtime JSON supplies absolute Windows `executable` and persistent `profile`, `debugPort`, and the optional exact `version` constraint. The caller supplies the reachable Windows PowerShell executable through existing `HostConfig`. This configured executable is Chrome for Testing; the platform does not locate, download, install or substitute a browser. The profile must already exist. Keep the existing headed launch configuration (`--user-data-dir`, `--remote-debugging-port`); no extra launch-policy mechanism is needed.

Use `acquireSession()` with the caller's existing `launch` setting. For the agreed recoverable stopped-browser case, the authorized assignment sets `launch: true`, which selects the existing `ensure` operation directly. Do not first attempt attach-only discovery, fail, and interpret that failure as permission to launch.

| Current state | Required behavior | Browser evidence |
| --- | --- | --- |
| Exact configured Chrome is running and healthy | Validate executable/profile/version constraint, headed root, unique listener ownership and fresh `/json/version`; establish the run-owned relay and attach | `PASS`, with `launched: false` |
| Configured Chrome is stopped; profile exists and configured port is free | Under existing launch serialization, launch the exact configured executable/profile/debug flags once, wait for host/CDP readiness, then attach | `RECOVERED`, with `launched: true` |
| Stopped but caller explicitly disallows launch | Do not override `launch: false` | `BLOCKED`, with the authorization reason |
| Active configured profile is unhealthy, identity is wrong/ambiguous, port conflicts, or profile/binary is missing | Preserve state; return the exact blocker | `BLOCKED`; no kill, alternate profile, or second browser |

The host helper already emits `launched` for `ensure`. Use that fact rather than inferring launch from a changed PID. A launch is not ready until CDP attachment and current incarnation validation succeed. Keep bounded readiness/cancellation and raw host errors. Waiting for startup is not replaying a proof action.

Persistent identity consists of the configured executable/profile/debug settings. PID/start time, browser WebSocket path, relay port/processes, Playwright/CDP objects, targets, target IDs and worker activity are current observations only. After a restart before a new proof, dispose only stale run-owned transport/client state, rediscover, and acquire fresh objects. Never cache an endpoint, target ID or Page for a later incarnation. A restart during setup invalidates earlier hook/target checks: complete a fresh preflight attempt rather than combine checks from different incarnations. No unbounded recovery loop is introduced.

A browser launched by preflight still has a caller-owned persistent profile and browser lifecycle. Ordinary teardown stops only owned connection state; it preserves Chrome, its persistent context and all observable browser state, including created targets.

### Host escalation

An explicit CLOSED-browser baseline is a separate caller lifecycle action before the cycle: use `prepareClosedBrowserBaseline(hostConfig, closeAuthorized)` after obtaining required host/HITL permission. It never launches Chrome. The baseline-only host probe returns STOPPED only after successful process/listener inspection proves zero configured-profile roots and zero listeners on the configured port; query failures, inaccessible candidate processes, conflicting identities or unhealthy/ambiguous listeners are BLOCKED. A running browser must validate exact configured identity before an authorized single CDP Browser.close; verify STOPPED afterward within the deadline. An already STOPPED baseline is READY without attachment or reset. Do not use acquireSession(launch:false) or interpret its combined absent/ambiguous error as baseline evidence. BrowserPreflight remains responsible for subsequent configured launch and RECOVERED reporting.

The calling frontend/invocation environment owns the existing HITL/escalation interaction; the Node runtime cannot grant itself host permission. Before the first known restricted WSL → Windows operation, obtain normal host escalation for the enclosing helper/runtime invocation. Reuse applicable approval already granted. Cover inspection, launch when assigned, and relay subprocesses through that supported invocation path. Do not discover a known approval requirement by first executing a forbidden subprocess, and do not bypass it through another driver.

If required approval is pending, denied or unavailable, report BrowserPreflight `BLOCKED` with the HITL reason and product proof `NOT RUN`. After approval, begin a fresh preflight attempt. No approval boolean, permission registry or policy engine is added to project configuration.

## Optional ProjectPreflightHook

The platform owns explicit reference resolution, compatibility checking, bounded invocation, deterministic context and evidence handling. The project owns the checked-in function, its input, observations and the meaning of project readiness. It is separate from a project proof provider; do not register it as a product-proof capability.

The caller's existing runner/fixture configuration supplies an optional `projectPreflightHook` reference alongside host/page configuration. The module may be stored as `.verification/preflight.mjs`; the name is an example, not an auto-discovery convention. Use one project-relative entry, resolved against an explicit project root, and no implicit working-directory/global fallback. An absent reference skips execution and records project `PASS` with reason `No project hook configured`. A configured but missing/invalid hook blocks.

Proposed reference (contract documentation, not implementation):

```ts
type ProjectPreflightHookReference = {
  contractVersion: 1;
  entry: string;       // project-relative checked-in JS module
  sha256: string;      // expected entry bytes, supplied by caller configuration
  deadlineMs: number; // positive bounded invocation budget
  input: JsonValue;   // project-owned expected identity/build/configuration
};
```

The module exports `contractVersion = 1` and `runPreflight(context)`. Check the reference version and entry digest before importing; verify the module export version before invoking. Module loading must have no setup side effects. Unsupported versions, malformed results, errors, cancellation and timeout produce a project blocker with raw diagnostics. No automatic install/build or hook retry occurs.

The minimal callable contract is:

```ts
type ProjectPreflightContext = {
  contractVersion: 1;
  projectRoot: string;
  environmentId: string;          // current assigned environment
  executionIdentity: ExecutionIdentity;
  browser: Browser;              // already attached; borrowed, observation only
  browserProvenance: { binary: string; profile: string; version: string;
    process_id: number; started_at: string; webSocketDebuggerUrl: string };
  input: JsonValue;              // copy of the configured project input
  evidenceDirectory: string;     // run-owned local output directory
  deadlineMs: number;
  signal: AbortSignal;
};
type ProjectPreflightResult = {
  contractVersion: 1;
  status: 'READY' | 'NEEDS_HITL' | 'BLOCKED';
  reason: string;
  evidence: { path: string; sha256: string }[]; // files under evidenceDirectory
  hitl?: { action: string; reason: string };   // required only for NEEDS_HITL
};
// runPreflight(context): Promise<ProjectPreflightResult>
```

`ExecutionIdentity` and `Browser` are the existing platform/Playwright types; `JsonValue` means JSON data, with no executable commands or live handles. The Browser is an in-memory observation surface, never serialized. The hook receives no host-session disposer or permission-granting callback. It can inspect current browser/extension facts and write evidence. It must not launch/restart/close Chrome, replace targets, modify persistent extensions, execute proof actions or orchestrate other hooks. This is a contract for trusted caller-selected project code, not a new code sandbox.

Validate result fields/version and evidence paths/digests. `READY` must include evidence of the configured checks. Record entry digest, input digest and observed facts with the current execution/browser identity. Dependencies, when needed, remain explicitly supplied project code with the project's existing source/provenance conventions; this entry contract is not a dependency registry. AI may assist authoring during adoption; normal execution calls the checked-in deterministic module.

The `hitl` field is required for NEEDS_HITL and absent for READY/BLOCKED. The hook must honor its deadline/signal and dispose its own temporary observation sessions. A deadline does not authorize killing Chrome; a timed-out hook cannot later promote the gate to READY. Preserve the blocked attempt and use existing owned worker/client finalization.

| Hook result | Platform behavior |
| --- | --- |
| `READY` | Project `PASS`; proceed to TargetPreflight |
| `NEEDS_HITL` | Project `BLOCKED`, preserve requested action/reason and evidence; return to the caller's normal HITL path; do not run TargetPreflight or proof |
| `BLOCKED` | Project `BLOCKED`, preserve reason/evidence; do not run TargetPreflight or proof |

Persistent installation, enabling/reload or replacement of an extension requires HITL. The hook reports the need; it does not perform it. After the authorized intervention, rerun preflight with fresh observations. The platform contains no Personalizer extension ID, build marker or readiness logic.

## TargetPreflight

Use the existing explicit `pageUrl` from `Assignment.environments[].selection`/fixture configuration. The initial readiness rule is intentionally small: exactly one live page has that URL, its document reaches `domcontentloaded` within the bounded readiness budget, and its browser/session incarnation remains current. Use the existing `HostConfig.readinessMs` as the target setup budget. Site-specific selectors, login state and expected product behavior remain in caller proof; READY does not assert those facts.

1. Enumerate pages afresh on the attached configured browser. One exact URL match is reused without navigation or reload.
2. Zero matches: require the existing assignment/plan effects to permit `target-create` and `target-navigate` and ownership to identify the new page as disposable. Create one page in the uniquely identified existing persistent context and navigate it to `pageUrl`. Do not navigate an unrelated borrowed tab or create a different profile/context.
3. Multiple matching pages, or no uniquely assigned persistent context for creation: `BLOCKED`. Do not guess, close duplicates or introduce ranking/selection policies.
4. Await document readiness, confirm the final URL still matches, discover the fresh CDP page-target identity and revalidate host incarnation. A redirect to an unassigned URL, target loss or readiness timeout blocks setup. The caller supplies the correct normal required URL; no Gemini-specific URL normalization belongs in the platform.
5. Return the actual fresh Page/target handle to the executor; write `PASS` for reuse or `CREATED` for successful creation/navigation. Failed creation/navigation is `BLOCKED`, with observed partial action retained as browser state and evidence.

`target-create` and `target-navigate` are two literal values in the existing string-valued allowed-effects contract, not a new action schema. Caller authorization cannot expand normative plan effects. They must be explicitly allowed for the reuse-or-create acceptance case. AUTO denotes permission to execute authorized setup without an additional product decision; it does not grant missing caller authorization.

All observable browser state produced or changed during a test cycle is part of the observable test result and survives proof/test execution, including TargetPreflight-created pages and partial setup on failure/cancellation. Ordinary per-proof/per-test teardown never closes these targets, resets browser state or calls target.dispose(), even with legacy cleanup authorization. Normal caller proof assignments omit `target` from ownership.cleanup (use cleanup=[] for browser targets); disposable ownership permits creation but does not authorize automatic teardown. Browser-state cleanup/reset is allowed only as an explicitly requested lifecycle action before a new test cycle requiring a clean baseline, or when explicitly terminating the overall verification/browser session according to session policy. The existing dispose() primitive remains available to that lifecycle caller with explicit target cleanup authorization; no new lifecycle framework is introduced. Reused pages are borrowed and preserved. Temporary verifier client/CDP/relay resources may be disposed without changing observable browser state. Current CDP target IDs are evidence, not future configuration.

## ENVIRONMENT READY and action boundaries

READY requires BrowserPreflight `PASS`/`RECOVERED`, project `PASS` (including explicit hook absence), TargetPreflight `PASS`/`CREATED`, valid preflight evidence and final continuity validation on the executor attachment. Yield the existing assigned Page only after this gate. Do not change how product assertions, observers, mandatory coverage or verdict reconciliation work.

After READY, an atomic proof retains the browser incarnation and selected target. Session loss, restart or target destruction must not trigger transparent preflight recovery or replacement in that proof. Preserve available observations; use existing BLOCKED-before-attempt/INCONCLUSIVE-after-attempt rules and retain any decisive FAIL. Fresh setup may precede a separately recorded later attempt. An intentional browser restart required by the proof is an explicit proof action with its own reacquisition/evidence, not preflight recovery.

| Category | Boundary |
| --- | --- |
| AUTO | Authorized exact configured Chrome launch/attach; run-owned relay/client setup; observational deterministic hook execution; authorized creation/navigation of the missing normal page; bounded readiness waits; assigned disposable cleanup |
| HITL | Known required host escalation; persistent extension/add-on installation, enabling/reload or replacement; destructive action affecting persistent/caller state |
| FORBIDDEN | Silent browser/profile substitution; killing an unknown browser process; silently replacing unknown persistent project state |

These are fixed rules in the existing execution/authorization path, not a generic policy engine. A closed configured browser and absent normal target are recoverable setup states when their actions are authorized.

## Evidence and blocked execution

Use ordinary output files/attachments, with a separate `preflight` record namespace. Do not put preflight PASS/RECOVERED/CREATED into product `Evidence`, which requires claim/proof mappings. A small schema-version-1 preflight record contains current `ExecutionIdentity`, environment ID, worker index, testKey at the proof gate, ordered stage observations, browser incarnation, hook reference/input digests when configured, target identity/ownership, reasons/raw diagnostics, bounded timing, file paths/digests and cleanup limitations. Live handles stay in memory.

Use one record per completed stage or gate:

```ts
type PreflightRecord = {
  schemaVersion: 1;
  identity: ExecutionIdentity;
  environmentId: string;
  workerIndex: number;
  testKey?: string;  // required when target/gate setup belongs to a proof test
  sequence: number; // monotonically increasing within this worker's setup
  stage: 'browser' | 'project' | 'target' | 'gate';
  status: string;   // constrained by stage as listed below
  reason: string;
  observations: JsonValue;
  evidence: { path: string; sha256: string }[];
  cleanupErrors: string[];
};
```

The schema permits browser PASS/RECOVERED/BLOCKED, project PASS/BLOCKED, target PASS/CREATED/BLOCKED, and gate ENVIRONMENT READY/PREFLIGHT_BLOCKED only. `observations` retains the source facts above, including hook READY/NEEDS_HITL/BLOCKED, observed incarnation, target identity/ownership and timing; it does not carry executable actions. Name canonical files `preflight-<execution-id-hash>-<worker-index>-<sequence>.json` under the existing output root and confine referenced evidence to that root. Browser/project records are worker-scoped; target/gate records for an actual proof test have its current testKey. For setup-only acceptance, no testKey is fabricated and those records cannot be used to manufacture test/claim coverage.

Flush browser and hook stage records as they complete, then target/gate records before entering proof. Attach/reference the same canonical files; do not collect copied Playwright attachments twice. Later stages not reached are recorded as `BLOCKED` with `not attempted: prior preflight stage blocked`, never as passed. Hook absence is explicit project PASS with no hook evidence. Current identity and stage order must validate before READY or a known blocker is accepted.

If required preflight evidence cannot be persisted or validated, do not yield READY; retain the collection error using the existing finalization path. Preflight facts are not reused from a prior execution.

Successful readable reports show, for example:

```text
preflight.browser  RECOVERED  exact configured Chrome launched and attached
preflight.project  PASS       configured hook checks established
preflight.target   CREATED    required target created, navigated and ready
ENVIRONMENT READY
proof ...                    existing product proof evidence, if assigned
```

For a blocked gate:

```text
preflight.browser  PASS
preflight.project  BLOCKED    NEEDS_HITL: expected extension build unavailable
preflight.target   BLOCKED    not attempted: project preflight blocked
PREFLIGHT_BLOCKED
proof: NOT RUN
```

Preserve the existing schema-version-1 `Result` and four verdicts. For plan-bound execution, map a validated known preflight blocker to affected existing ClaimRecords: `attempted: false`, `outcome: blocked`, empty assertions/product evidence IDs, prerequisite error in phase `readiness`, concrete reason. Map only the current affected environment/test obligations; retain every required pair in the result. Aggregate is BLOCKED unless existing stronger evidence requires otherwise. No new proof claims are invented for setup.

The reporter and crash finalizer must both consume flushed current preflight blockers and persist those same unattempted ClaimRecords. READY alone never creates a proved ClaimRecord. Missing/stale evidence or a crash before a known gate outcome retains uncertainty. Keep actual Playwright runner status/exit: a fixture failure can produce runner `failed` even though proof is `NOT RUN`. Do not replace that runner status with a fictional `not-run` status.

For preflight-only acceptance, use the real current configured invocation/ExecutionIdentity and retain the preflight records and READY outcome without fabricating a product plan/result PASS. Its plan/bundle identities can identify setup even when that product proof is not executed; never fill identity fields with placeholder digests. Existing product result validation continues to validate proof records; it cannot treat the preflight sidecar as product evidence.

## Ownership and first Personalizer acceptance

| Platform-owned | Project/caller-owned |
| --- | --- |
| BrowserPreflight, host transport/identity validation, optional hook execution contract, TargetPreflight, gate and preflight evidence | Exact runtime configuration, assignment/effects/ownership, hook entry/input/build expectations, normal required URL, project readiness facts |
| Existing proof runtime and evidence reconciliation | Product plan, concrete assertions, authoritative project observations and acceptance decisions |

Initial real acceptance: configured Chrome for Testing is closed, the existing configured profile is present, and a Gemini tab is not assumed to exist. The caller supplies launch authorization, required target effects/ownership, the actual Gemini URL, and a separately adopted deterministic Personalizer hook with the expected extension identity and development build.

```text
BrowserPreflight → exact Chrome/profile launched → fresh successful attachment
ProjectPreflightHook → Personalizer installed/enabled/expected identity/build verified
TargetPreflight → Gemini target created/navigated if absent → deterministic readiness
ENVIRONMENT READY
```

The future project hook must obtain authoritative installed/enabled/identity/build observations; the platform does not infer them from the presence or absence of a service-worker target. If the configured project checks cannot be established, report the corresponding blocker/HITL need. Browser inspection/proof of that hook is part of subsequent project adoption, not this documentation task.

All these starting states must produce the same READY gate, with recovery evidence reflecting actual setup:

| Starting state | Browser | Target | Gate |
| --- | --- | --- | --- |
| Chrome running, Gemini open | PASS | PASS | ENVIRONMENT READY |
| Chrome running, Gemini absent | PASS | CREATED | ENVIRONMENT READY |
| Chrome closed, Gemini absent | RECOVERED | CREATED if still absent after launch; PASS if profile startup restores it | ENVIRONMENT READY |

Do not suppress session restoration or destroy existing tabs to force CREATED. Passing Personalizer T012 or `Personalizer → Edit` is not required. Stop this acceptance at READY; ordinary proof evidence is collected only for a separately assigned proof.

## Implementation record — Sol Medium

The implementation follows the stages and contracts above. The file list below records the canonical source and focused verification.

**Existing files likely to change:**

- `runtime/fixtures.ts`: shared BrowserPreflight acquisition/attachment, optional worker hook, test-scoped target gate before yielding `assignedPage`; preserve ownership and zero proof retries. Supply explicit project root/environment/hook reference through caller-composed options. Preserve legacy attach-only behavior when the caller forbids launch; creation requires the two explicit effects above.
- `runtime/index.ts`: export the preflight functions/types from the existing public runtime entry.
- `runtime/evidence/readiness.ts`: flush/validate preflight stage/gate files and share conversion of known blockers to unattempted readiness ClaimRecords.
- `runtime/reporter.ts` and `runtime/invoke.ts`: collect/reference preflight records separately; use the same blocker conversion on normal/crash paths and preserve actual runner status.
- `frontends/browser-verification/result-adapter.ts`: expose ordered preflight facts and NOT RUN for a blocked gate alongside existing shared product reconciliation; no second verdict algorithm.
- `src/contracts/index.ts`: small reference/result/serialized preflight types; keep existing product result/binding contracts intact.
- `src/resources/inventory.ts`: include the new module in the same distribution. Existing assembly already collects schemas; no release or publication is part of implementation.
- `frontends/browser-verification/SKILL.md`, `frontends/verification-orchestrator/SKILL.md`, `runtime/host/wsl-windows/wsl-windows-chrome-current.md`, `contracts/contracts.md`, `contracts/verification-integration.md`: focused setup/escalation/hook/evidence guidance. Clarify the integration contract's existing “project hooks” phrase about proof instrumentation so it does not forbid this optional readiness hook.
- `examples/playwright.config.ts`, `examples/verification-fixtures.ts`: minimal caller-composition example with explicit hook reference, environment and existing authorized effects/ownership; no Personalizer defaults.

**New production files:** `runtime/preflight.ts` implements shared stages and bounded hook loading/execution; `schemas/preflight.schema.json` defines the serialized sidecar. The existing session/runtime helpers were extended with the closed-browser baseline probe and lifecycle operation, while reusing the same configured browser and incarnation validation. No separate subsystem was added. Native-menu implementation/descriptors are outside this work.

**Hook:** explicit project-relative JS module reference with version 1, expected SHA-256, input and deadline; exports version 1 and `runPreflight(context)`; returns only READY / NEEDS_HITL / BLOCKED with reason/evidence and HITL request when needed. Concrete `.verification/preflight.mjs` creation belongs to a separately authorized consuming-project adoption pass; do not modify custom-ui during platform implementation.

**Order:** validate existing inputs/authority and obtain required host escalation → BrowserPreflight acquire/attach → invoke configured project hook or explicit absence → TargetPreflight reuse/create/navigate → final incarnation/target/attachment check and flushed READY gate → existing proof executor. Any blocked stage stops proof.

**Focused tests:** `tests/runtime/preflight.test.mjs` covers stage order, convergence states, actual launch reporting, hook absence/outcomes/version/digest/invalid-result/deadline handling, action authorization, exact reuse and owned creation, ambiguity rejection, and fresh-handle rejection across restart/READY. The selection, crash collection and agent result suites cover separate records, current identity/blocker mapping, NOT RUN, and prevention of product PASS/FAIL fabrication. Host regressions cover baseline state, launch/freshness and ownership. Browser-worker routing has a canonical frontend helper and focused test. Build, TypeScript, ordinary-runner compatibility and distribution inventory/relocation checks pass.

**Personalizer acceptance procedure:** in a separately authorized project adoption, configure its deterministic hook and expected identity/build, exact existing Chrome/profile, actual Gemini URL and authorized setup effects. Establish the three initial states using the caller's normal HITL path for closing caller-owned Chrome/tabs when needed. Run shared preflight to READY only; retain configured/observed browser identity, hook observations and target readiness records. Verify the table above, preserve the profile/browser and all observable browser state, including created pages, after execution, and do not run T012 or Edit as an acceptance requirement. Send only the unresolved live browser-owned acceptance claims to the existing browser-verification workflow. No broader platform redesign or runtime AI judgment is required.
