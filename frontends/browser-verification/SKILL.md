---
name: browser-verification
description: Gather evidence for bounded browser claims using Playwright, browser-level CDP, and supported Windows native UI semantic patterns. Runtime and scenario configuration come from the caller.
---

# Browser verification

The caller owns scope, expected behavior, implementation and final decisions. This harness returns browser facts; it does not decide workflow completion or update project artifacts. Use it only for unresolved claims requiring browser evidence. Return already-proved or non-browser claims without browser actions. Normal verification is closed-scope: execute supplied claims and diagnosis only.

## Assignment contract

Supply unresolved claims, each run's distinct proof purpose, existing relevant evidence, scenario instructions, expected observable state, and allowed actions. Supply the intended runtime/attachment, named Playwright session, resource ownership and cleanup boundary. Site URLs, selectors, account requirements, extension IDs, target criteria and expected effects belong to this assignment or caller-owned configuration outside the core. The harness has no site or account defaults. Missing behavior or authorization returns to the caller.

## Routing and agents

Delegate execution to exactly one browser worker at a time: `browser_luna` by default; sequentially hand off to `browser_sol` only for unresolved technical browser/runtime ambiguity or difficult diagnosis. The installed browser-agent TOML files own model IDs and reasoning effort. Workers do not redelegate, edit application code, reinterpret expected behavior, or expand coverage. Preserve valid evidence and healthy attachments across handoff. Remaining uncertainty returns to the caller.

Choose a backend by the claim:

- Page/web: read and follow the installed `playwright-cli` skill. Use its navigation, locators, DOM inspection, click/right-click, keyboard, focus, frames, assertions and screenshots in the assigned attachment.
- Browser protocol: use the attached Playwright browser's `newBrowserCDPSession()` and CDP. Page evidence alone does not prove a native UI action.
- Native semantic UI: use [native helper](../../runtime/host/wsl-windows/native-ui.ps1) only for supported Windows UIA inspection, InvokePattern or ExpandCollapsePattern. Selectors come from the run. Native UI does not automate page DOM.

## Runtime and lifecycle

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

## Evidence, handoff and cleanup

Prefer structured runtime/protocol/DOM/native evidence when it proves the claim. Use screenshots for observable properties that need visual evidence. Collect console, network or traces only for assigned claims/diagnosis. Unexpected observations are findings, not new tasks.

Keep one setup/attachment for the ongoing run. Intermediate results and role handoff do not detach. At the caller's final cleanup boundary, remove only verifier-owned disposable resources, detach from the externally owned browser, then stop verifier-owned relay processes. Leave the persistent browser/profile intact unless teardown is explicitly assigned. Never use blanket close/kill operations, logout, uninstall or profile reset as cleanup.

Return claim, proof purpose, observed facts, PASS/FAIL/INCONCLUSIVE against supplied expected state, rejected claims/reasons, exact errors/limitations, and current runtime/attachment/target state. Report runtime values as observations, never future connection configuration. When execution is unavailable return BLOCKED with the reason. An escalation request is `ESCALATE: browser_sol` with unresolved claim, blocker, evidence and attachment state. Results convey facts only; downstream workflow decisions belong to the caller.

## Shared deterministic mode and results

For a valid caller-authorized plan, use the platform verification-orchestrator frontend and ordinary Playwright Test configuration. Typed runtime/fixture entries consume the same canonical helpers. Structured results go through `result-adapter` and the shared evidence/reconciliation contracts; complete mandatory coverage is required for plan-wide PASS. Bounded readable reports retain all observations, limitations and attachment state. No agent verdict algorithm replaces shared reconciliation.
