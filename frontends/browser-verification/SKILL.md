---
name: browser-verification
description: Gather evidence for bounded browser claims using Playwright, browser-level CDP, and supported Windows native UI semantic patterns. Runtime and scenario configuration come from the caller.
---

# Browser verification

The caller owns scope, expected behavior, implementation and final decisions. This harness returns browser facts; it does not decide workflow completion or update project artifacts. Use it only for unresolved claims requiring browser evidence. Return already-proved or non-browser claims without browser actions. Normal verification is closed-scope: execute supplied claims and diagnosis only.

## Assignment contract

Supply unresolved claims, each run's distinct proof purpose, existing relevant evidence, scenario instructions, expected observable state, and allowed actions. Supply the intended runtime/attachment, named Playwright session, resource ownership and cleanup boundary. Site URLs, selectors, account requirements, extension IDs, target criteria and expected effects belong to this assignment or caller-owned configuration outside the core. The harness has no site or account defaults. Missing behavior or authorization returns to the caller.

## Routing and agents

Delegate execution to exactly one browser worker at a time: `browser_luna` by default; sequentially hand off to `browser_sol` for unresolved technical browser/runtime ambiguity, difficult diagnosis, or the parent-owned silent-worker rule below. The installed browser-agent TOML files own model IDs and reasoning effort. Workers do not redelegate, edit application code, reinterpret expected behavior, or expand coverage. Preserve valid evidence and healthy attachments across handoff. Remaining uncertainty returns to the caller.

### Parent-owned first-response liveness

The parent MUST apply [browser worker routing](assets/browser-worker-routing.cjs) to every browser-worker assignment. Start with the configured `browser_luna` (currently gpt-6-luna / Medium); escalation uses the configured `browser_sol` (currently gpt-6-luna / High). This rule belongs to the parent and does not depend on the worker requesting escalation. Caller-generated assignment restrictions such as “no model escalation” cannot override it. Only an explicit platform/user policy disabling model escalation may do so; pass that policy separately as `modelEscalationDisabled`, never infer it from generated assignment text.

Before dispatch, retain the original assignment with its `executionId`, positive `attempt`, evidence path and attachment/ownership information. Take the parent monotonic start time immediately before spawning Medium and record the returned worker/task ID; `retainBrowserAttempt` sets a **60,000 ms first-response deadline** from that time. Persist this record in parent storage, including original Medium and current worker IDs. The parent owns waiting/observation and checks at the deadline; this is not an inactivity timeout. Any normal response or tool dispatch preserves existing routing. Explicit `ESCALATE: browser_sol` technical-ambiguity requests still use sequential handoff.

At the deadline, call `routeBrowserAttempt` with an authoritative, cumulative worker observation: `workerId`, `complete` (telemetry coverage from dispatch through observation), `responses`, `toolDispatches`, and `sideEffects`. Count every tool dispatch, including pending/in-flight calls; absence of a final answer, empty mailbox, or absence of browser evidence is NOT proof of zero dispatch. `sideEffects: false` requires complete dispatch accounting establishing that this worker could not act. Missing/unavailable telemetry, uncertain counts or possible side effects returns BLOCKED with no escalation. If the parent tools cannot expose this accounting, BLOCK; never synthesize confirmed zero values.

Supply parent adapters `save(state)` (persist before every handoff action), `stop(workerId)`, `observe(workerId)` and `spawn(role, originalAssignment, handoff)`. `stop` must stop that exact worker and return `{workerId, terminated: true}` only after execution and pending dispatch are quiescent; an interrupt request or prior-status response alone is insufficient. `observe` must provide a fresh authoritative cumulative snapshot after termination. A changed/nonzero dispatch or response, unknown effects, missing identity or uncertain termination returns BLOCKED. Only then may `spawn` assign High and return its new worker ID. Preserve the SAME `executionId`, `attempt`, evidence path, assignment, attachment and existing valid evidence; the handoff records both worker identities. Do not increment the attempt, replay a command or acquire a new browser. Persist `stopping`/`handing-off` before awaiting adapters; never resume these states by spawning again after interruption or a lost handle—return BLOCKED. High never overlaps Medium and receives no further automatic liveness escalation.

This is escalation within one logical browser attempt, not a retry. The helper only decides and sequences handoff; it does not launch browsers, implement a scheduler, poll a runtime, or change Verification Platform preflight. It can be rendered for a tools-only parent execution cell with `node <skill directory>/assets/browser-worker-routing.cjs --render`; load the persisted record and keep `routeBrowserAttempt` awaited. Stop/final-observation/spawn adapters must use the parent agent service's confirmed state, not browser probes.

Choose a backend by the claim:

- Page/web: read and follow the installed `playwright-cli` skill. Use its navigation, locators, DOM inspection, click/right-click, keyboard, focus, frames, assertions and screenshots in the assigned attachment.
- Browser protocol: use the attached Playwright browser's `newBrowserCDPSession()` and CDP. Page evidence alone does not prove a native UI action.
- Native semantic UI: use [native helper](../../runtime/host/wsl-windows/native-ui.ps1) only for supported Windows UIA inspection, InvokePattern or ExpandCollapsePattern. Selectors come from the run. Native UI does not automate page DOM.

## Runtime and lifecycle

For a caller-required CLOSED-browser baseline before a test cycle, use the caller's Verification Platform `prepareClosedBrowserBaseline(hostConfig, closeAuthorized)` after normal host/HITL approval. This baseline-only operation proves absence from successful process/listener inspection; it accepts already STOPPED as READY without launch, or closes only the validated configured browser when authorized and verifies STOPPED. Ambiguity/query failure/unauthorized reset is BLOCKED. Never treat acquireSession(launch:false)'s absent-or-ambiguous attachment error as proof of absence. Stop at a baseline blocker; do not launch acceptance to discover whether preparation worked. Subsequent BrowserPreflight alone launches Chrome and reports RECOVERED.

Reuse a healthy caller-supplied attachment. Select no browser, version, profile, site or account implicitly. This harness retains a Windows headed Chrome runtime helper and WSL byte relay; it is not a browser installer. Only the supported WSL → Windows attachment topology is available.

For Windows runtime inspection/reuse/optional launch, read [runtime contract](../../runtime/host/wsl-windows/wsl-windows-chrome-current.md). Use `../../runtime/host/wsl-windows/browser-session.py --config <external runtime JSON> --powershell <Windows PowerShell executable reachable from WSL>`; add `--launch` only when launch is assigned. JSON requires absolute Windows `executable`, existing persistent `profile`, integer `debugPort`; optional `version` is an exact caller-supplied constraint. Nothing resets, creates, migrates or deletes a profile.

The helper validates binary/profile/headed process and debug listener ownership, queries fresh `/json/version`, and retains the complete process-specific browser WebSocket path. It reuses a healthy matching process; an active unhealthy/conflicting profile or occupied port blocks a second launch. Never use an old process endpoint, bare `/devtools/browser`, guessed PID, cached discovery or a different browser/profile to bypass failure.

Attach with the current returned `cdp_endpoint`:

```bash
PLAYWRIGHT_MCP_CDP_TIMEOUT=600000 playwright-cli -s='<run session>' attach --cdp='<current endpoint>'
```

Read [timeout controls](assets/playwright-cdp-timeout.md) only when needed. The relay stays alive for the attachment lifetime and revalidates process incarnation and discovery on each connection. On genuine session loss, stop using the invalid attachment, perform fresh discovery for the assigned runtime, and re-attach the named session. Do not restart a healthy browser to recover a driver session. A process restart invalidates old targets and endpoints. Native actions also revalidate runtime and selected elements immediately before acting.

## Generic CDP and extensions

[canonical extension helper](../../runtime/cdp/extension-action.cjs) exports:

- `browserCDP(browser)` — temporary browser-level CDP session from an existing Playwright browser.
- `discoverTargets(cdp, filter)` — explicit nonempty CDP target filter.
- `selectTarget(targets, criteria)` — exact supplied target fields; reject zero or multiple matches.
- `discoverExtension(cdp, extensionId)` — exact supplied ID through `Extensions.getExtensions`; reject zero or multiple matches.
- `triggerExtensionAction(browser, {extensionId, target: {filter, criteria}})` — discover extension and target afresh, invoke once, return observations and protocol errors, detach only its temporary CDP session.

`Extensions.triggerAction` requires `type=tab` as a Chrome protocol invariant. Use an explicit filter including tabs, typically `[{"type":"tab","exclude":false},{"exclude":true}]`, and caller-supplied criteria such as URL, title or targetId. Page targets are rejected. All action inputs come from the run. No tab activation, native fallback or guessed target occurs on failure. Command success proves invocation only; verify the caller's expected effect separately.

For execution in the existing Playwright session, put run options in an external JSON file, then:

```bash
node <distribution>/dist/runtime/cdp/extension-action.cjs --options <run options JSON> > <temporary run-code file>
playwright-cli -s='<existing session>' run-code --filename=<temporary run-code file>
```

Generic CDP primitives can also be used directly in caller run-code. The caller owns temporary CDP session cleanup when using primitives directly.

## Native semantic primitives

The WSL wrapper `../../runtime/host/wsl-windows/native-ui` requires `BROWSER_VERIFICATION_POWERSHELL` from the environment. Pass `-ConfigPath <Windows path to runtime JSON>` on every call. Operations: `windows`, `tree`, `inspect`, `invoke`, `expand`. Supply `-WindowCriteria` and, where needed, `-ElementCriteria` as JSON objects using exact `name`, `type` (UIA programmatic name), `class`, `id`, `handle`, or `processId` fields. Nonempty criteria, unique matches, intended runtime ownership and supported patterns are required. `windows` enumerates intended-runtime windows; `tree` inspects descendants outside UIA Document content. Inspect returns supported pattern names.

Invocation/expansion requires an assigned action, a live unique element, enabled/visible state and the corresponding semantic pattern. Unsupported patterns, ambiguity, stale elements and errors stop the action. There is no automatic permission decision, menu navigation, extension workflow, pointer/coordinate fallback, center-hit or DPI workaround. Expansion proves only that the requested pattern call completed; its application meaning and expected effect come from scenario instructions.

## Generic native menu path

Import `nativeMenuPath` from `<distribution>/dist/runtime/index.js` for an explicitly assigned hierarchical context-menu interaction. Both frontends use this one Host Runtime Adapter/UIA implementation. Inspect `generic:native` / `native:menu` in the pinned descriptor and current readiness before generating a proof; unestablished support remains BLOCKED even when the implementation is callable for capability validation.

For native-only menu assignments, use the existing platform fixture and ordinary Playwright runner with one borrowed attachment and the original Host Runtime Adapter session. The CLI sandbox cannot import Node host modules; it must not gain a duplicate driver or a copied menu interpreter. Resolve the exclusive attachment/cleanup boundary with the caller before switching from an existing CLI attachment.

Supply the existing borrowed browser/page, current host session, exact source window and target, exact native labels, authorized context-menu input and optional downstream observation. Use fresh target/runtime/window binding, structured menu roots and ancestry, supported Expand/Invoke patterns and immediate retained-element revalidation. Separately rooted submenus must be uniquely tied to the current expansion lifecycle; unsupported or ambiguous structures fail closed. No coordinate semantic fallback or direct extension-handler invocation is allowed. Serialize the complete result as raw evidence through the shared recorder; invocation completion alone does not prove an application outcome. Preserve uncertainty after possible action; never replay automatically.

## Evidence, handoff and cleanup

### Follow one long-running execution

For tool-launched browser verification, use the [execution follower](assets/follow-execution.cjs). The caller supplies one explicit `executionId`, positive `attempt`, exact `evidencePath`, and `command` object for `tools.exec_command` (including already required host escalation). Save this request before launching. Start exactly once; the helper stores the complete result and polls the same `session_id` with `tools.write_stdin` until terminal `exit_code`. Never reduce the launch result to `text(result.output)`.

There are two different handles: an outer `functions.exec` cell ID and the inner process `session_id`. `functions.wait` follows the outer cell; its completion alone does not prove that the inner process exited. Retain both when yielded. The helper keeps the inner handle in the execution cell's `store` and awaits that process to completion. If interrupted, call the same helper with mode `follow`; missing state/handle, a changed handle or failed polling returns BLOCKED without another launch. Never start again to obtain a missing report. A retry needs explicit caller authorization, a new attempt identity and a separate evidence path.

In a tools-only execution cell, load the matching helper's self-contained source and keep the helper call awaited:

```js
// @exec: {"yield_time_ms": 1000, "max_output_tokens": 1500}
const rendered = await tools.exec_command({
  cmd: 'node <distribution>/dist/frontends/browser-verification/assets/follow-execution.cjs --render',
  max_output_tokens: 6000
});
if (rendered.exit_code !== 0) throw Error('Execution follower unavailable');
const follower = eval(rendered.output);
const request = load('caller-browser-attempt'); // saved explicit request
const completed = await follower.followExecutionAttempt(
  tools, { get: load, set: store }, request, 'start',
  state => notify({ executionId: state.executionId, attempt: state.attempt,
    status: state.status, session_id: state.sessionId })
);
text(completed);
```

After terminal completion, read only `completed.evidencePath`; validate the parsed artifact with `acceptAttemptEvidence(completed, artifact, completed.evidencePath)`. The artifact must carry the same `executionId` and `attempt`. Do not search for the newest output or substitute another invocation's records. A terminal nonzero exit still belongs to this attempt and does not authorize replay. BLOCKED handle following stops execution and evidence collection.

Prefer structured runtime/protocol/DOM/native evidence when it proves the claim. Use screenshots for observable properties that need visual evidence. Collect console, network or traces only for assigned claims/diagnosis. Unexpected observations are findings, not new tasks.

Keep one setup/attachment for the ongoing run. Intermediate results and role handoff do not detach. Preserve all observable browser state produced or changed during the test cycle, including pages created by TargetPreflight and proof actions, after successful, failed or blocked execution. Ordinary per-proof/per-test teardown must not close targets, reset browser state or call target.dispose(); normal proof assignments use ownership.cleanup=[] for browser targets, even when ownership.disposable includes target. Disposable ownership is not an instruction to clean up after proof. Detach temporary verifier clients/CDP sessions and stop owned relays only at the assigned connection boundary, without changing observable browser state. Browser-state cleanup/reset is allowed only as an explicitly authorized lifecycle action before a new test cycle requiring a clean baseline, or when explicitly terminating the overall verification/browser session according to session policy. Low-level disposal remains available for those actions with the existing ownership/cleanup authorization and HITL rules. Never use blanket close/kill operations, logout, uninstall or profile reset as ordinary cleanup.

Return claim, proof purpose, observed facts, PASS/FAIL/INCONCLUSIVE against supplied expected state, rejected claims/reasons, exact errors/limitations, and current runtime/attachment/target state. Report runtime values as observations, never future connection configuration. When execution is unavailable return BLOCKED with the reason. An escalation request is `ESCALATE: browser_sol` with unresolved claim, blocker, evidence and attachment state. Results convey facts only; downstream workflow decisions belong to the caller.

## Shared deterministic mode and results

For a valid caller-authorized plan, use the platform verification-orchestrator frontend and ordinary Playwright Test configuration. Typed runtime/fixture entries consume the same canonical helpers. Structured results go through `result-adapter` and the shared evidence/reconciliation contracts; complete mandatory coverage is required for plan-wide PASS. Bounded readable reports retain all observations, limitations and attachment state. No agent verdict algorithm replaces shared reconciliation.

## Shared preflight gate

Before proof, use the shared runtime exports through the supported Node/host path: browserPreflight → projectPreflight (optional explicitly referenced checked-in project hook) → targetPreflight → environmentReady. Provide a PreflightRecorder with the current real execution/environment identity and output root. Hook reference/context/result follow the version-1 public contracts; project readiness semantics remain project-owned. Do not add hook configuration to platform.json or project-specific extension logic to this frontend.

Obtain known required host escalation via the normal caller/HITL invocation path before the first restricted WSL → Windows operation. Keep the helper alive, reuse only exact configured executable/profile/debug settings and honor launch authorization. A closed configured browser with authorized ensure is recoverable setup. Required extension installation/enabling/reload/replacement is a HITL need returned by the project hook; it is not an automatic hook action.

For the ordinary fixture path, the automatic gate completes before assignedPage/test body. For a CLI executor, complete its named attachment and reacquire the exact observed page-target identity before final environmentReady validation on the executor attachment. targetPreflight alone does not declare READY. Do not serialize a Page as a handle or run CLI/ordinary proof concurrently. Missing pages may be created/navigated only with the existing required effects/disposable ownership. Do not recover or silently replace browser/target identity inside an atomic proof.

Return ordered preflight facts separately from product proof. Feed validated preflightRecords to the typed result adapter alongside existing observations. PREFLIGHT_BLOCKED means proof NOT RUN; preserve actual runner status and unattempted blocked claims. ENVIRONMENT READY establishes setup only, never product PASS. Retain sidecar files/attachments and existing borrowed-state cleanup.
