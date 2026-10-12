# Public contracts — format 1

`src/contracts/index.ts` declares the serialized contracts. All JSON schemas carry `schemaVersion: 1`; resource formats use 1. Unknown versions/fields are rejected. Namespaced capability `contractVersion` identifies callable semantics and does not create a separate release. Binding resource IDs resolve only through its index. Repository/tag/commit/index identify one immutable `vMAJOR.MINOR.PATCH` set.

`resolveResources(binding, {root,indexPath,mode})` checks exact bytes, index identity and referenced resource versions. `root/indexPath` is explicit local installed/offline resolution configuration; release retrieval is separate from execution. There is no network fetch or fallback in this resolver. `validatePlan({planBytes,binding,resolution,projectRoot?,assignment?})` returns validity, exact plan digest, normalized binding digest, index digest and path/reference diagnostics. The same function is called by producers, gates and compilation. CLI `verification-validate` reads that object on stdin and emits one JSON result (0 valid, 2 invalid). Binding digest is SHA-256 of its schema-validated JSON serialization, retaining property order; processes that additionally fingerprint local file bytes retain their normal rule.

Provider registration is explicit module import. A descriptor identifies actual exports, declarations, versions, capabilities, type locations, effects/ownership, prerequisites, bounded deadlines and established source limits. Readiness is available/unavailable with evidence, never product acceptance. `unestablished` descriptors are excluded from generation. Shared fixture entry composes with ordinary `test.extend`; no provider download/registry/dispatcher exists.

`Readiness.capabilityVersion` is an optional nonblank string in the existing format-1 record for structural compatibility. `capabilityReadiness` emits each descriptor's `contractVersion`. Runnable bundle validation accepts only schema-valid available readiness with matching capability ID, exact capability contract version and environment, plus nonempty evidence references. A legacy versionless record remains readable but cannot establish availability: collect readiness for the selected current descriptor/source rather than relabel old observations. Exact-version matching prevents cross-version joins, not false/stale evidence; actual readiness observations remain caller/provider responsibility under current authorization.

`validateCoverage` retains the full required pair set, exact mandatory proof/source/mode references and every consumer-pinned capability/version. Additional compiler-selected operations use existing manifest capability fields with a version for every listed ID; they cannot replace normative pins or weaken mandatory proof. `validateBundle` checks all runnable declared operations against actual established exports at the exact version, version/environment-matched readiness, effects, current source/provider/fixture identities and typechecking. Its public `/compilation` return includes `valid`, `fullyReconciled`, `diagnostics` and the existing plan `validation` when available. `valid` continues to permit complete coverage with blocked entries for partial execution. `fullyReconciled` is `valid && manifest.entries.every(entry => entry.blocker === undefined)`; invalid normal returns set it false. It is a transient mechanical output, not a new schema/state/manifest or product-proof verdict.

Neither mapping validation nor `fullyReconciled` detects an omitted necessary operation or establishes semantic fidelity. The AI compiler audits each original mandatory proof/source into actual test operations, observations, assertions and timing/human contributions, referencing existing manifest steps/assertions and normal explanation. Full executable reconciliation reporting requires that semantic judgment and mechanical success with no unresolved mandatory gap. An omitted stimulus or unrelated assertion can otherwise pass metadata/type checks. Product proof remains separate and conditional on the semantic fitness of assertions/evidence; the reconciler checks declared joins/provenance/integrity, not their meaning.

Runtime acquisition returns current endpoint/provenance plus owned revalidation/disposal. Borrowed resources are never closed by ownership disposal. CDP/native exact criteria use the same canonical implementations. Observers start before action, acknowledge ready, expose bounded observations/loss and idempotent disposal. Failure phases are readiness/action/observation/cleanup; raw errors remain available and uncertain action is never replayed automatically. Operations remain unavailable until implemented and established in the assigned environment.

Transient `Invocation` names plan path/digest, resolved binding and assignment. Assignment authorization is a reference tied to plan/binding digests, not a boolean permission creator. Providers/configuration/ownership/effects/output constraints are explicit. `InvocationReturn` records generated/blocked/complete status, bundle/manifest/result/evidence paths, diagnostics and separate runner/acceptance exits. Generation/type failure blocks execution, not product behavior. No process scanning or handoff registry occurs.

`Manifest` records every required pair, source/proof obligations, stable annotated `testKey`, ordinary source/title/assertion/step references, capabilities and concrete blockers. Execution identity includes plan/binding/assignment/generated-source SHA-256, provider versions, execution/attempt, runtime/build/tool provenance. Any changed identity invalidates mapping. Tests, reporter, crash finalizer and bounded agent frontend use one reconciliation implementation; no LLM supplies missing facts.

Evidence keys are `(executionId,evidenceId)`, claims `(claimId,environmentId)`, tests `testKey`. Evidence records source/provider sequence, namespaced identities, finite window/coverage/loss, attachment bytes digest and raw facts. Opaque objects stay in memory. Wall clocks across hosts are not ordering authority. Attempt starts are flushed before relevant action; completion follows required assertions/evidence. Product contradictions are recorded before original assertion errors are rethrown. Arbitrary exceptions remain unresolved.

Result schema preserves all required entries, counts, runner exit/status and limitations. Prior proof requires checked current identity/environment/build/behavior and explicit validity conditions; historical screenshots alone cannot satisfy current obligations. Human evidence is explicit and never implied by automated success.

Execution identity also hashes actual caller fixture bytes and exactly one configured provider implementation/declaration source per provider ID/version/entry. Fresh discovery imports the entry under its content digest and rejects changes during discovery. Typechecking and result validation recheck those byte identities, preventing same-version edits from silently retaining a prior mapping. Generated sources must import the configured composed fixture's `test` and `expect`.

`validateResult`/`verification-validate-result` accept current plan bytes, exact binding/resolution, assignment, manifest/result, flushed records/evidence and explicit project/source/output roots. They structurally reject malformed contracts before identity access, re-resolve current resources, verify current fixture/provider/generated source bytes and call the same mandatory-proof reconciliation. A returned PASS requires equality with the current complete reconciled result, not a green exit or report filename.

`nativeMenuPath` adds the `native:menu` contract version 1 under the existing `generic:native` provider. Existing `nativeOperation` inputs/outputs and all serialized format versions remain compatible. Menu-path evidence is serialized as raw attachment bytes using `EvidenceRecorder.observation`; the claim/result pipeline continues to require execution identity, mandatory evidence and assertions. A menu result PASS proves the assigned semantic path (and optional requested correlated outcome), not unassigned product behavior. Descriptor support and current readiness still govern generation; calling an unestablished implementation for platform establishment does not authorize consumer proof.

## Preflight contracts

The runtime exports `browserPreflight`, `projectPreflight`, `targetPreflight`, `environmentReady` and `PreflightRecorder`. `PreflightOptions` in caller fixture configuration supplies explicit project root/environment, current assignment, original plan bytes and manifest, plus optional `projectPreflightHook`. Before selecting or using any concrete browser, browser version, profile, site or account for verification, obtain explicit user approval of the proposed selection. The AI may autonomously discover suitable candidates and derive their technical details, but must not commit to or use a candidate before approval. Present the concrete proposed browser/runtime, version, profile, site and account together as one authorization decision; do not ask the user to supply discoverable technical values. Honor explicit user/task constraints when preparing the proposal. Reuse existing explicit user approval only when it covers the exact proposed selection; discovery, task constraints, automatic approval review and elapsed time are not selection approval. After approval, record the approved selection and its observed source in the existing assignment/configuration and evidence, then continue through the existing Platform configuration, Host Runtime / BrowserPreflight identity validation and continuity guarantees. Selection approval does not authorize other restricted actions or change claims, expected behavior or required environment coverage. Do not silently substitute an environment during proof; a changed selection requires explicit user approval. Plan/assignment identities and the exact selected host/page configuration are checked before runtime effects. Known host escalation belongs to the caller's normal invocation path before starting host operations.

`ProjectPreflightHookReference` specifies contractVersion 1, project-relative JS entry, expected SHA-256, positive deadlineMs and JSON input. The module exports contractVersion 1 and `runPreflight(context)`. Context contains current execution/environment identity, explicit project root, borrowed observation-only Browser/provenance, copied input, evidence directory, deadline and signal. Return READY / NEEDS_HITL / BLOCKED with version, reason and evidence paths/digests; NEEDS_HITL alone requires an action/reason request. READY requires readiness evidence. Entry/version/result/evidence/deadline/cancellation are checked. Hooks are trusted deterministic project code subject to the observation-only contract, not a code sandbox or orchestration engine.

`schemas/preflight.schema.json` describes stage/gate sidecars, separate from product Evidence and the unchanged Result schema. Canonical files are `preflight-<execution-id-hash>-<worker-index>-<sequence>.json`. Validate current identity, ordering and confined evidence digests before READY or blocker consumption. Worker browser/project observations precede each test's target/gate records. READY cannot prove product claims; known blockers map through the shared readiness conversion to attempted=false/outcome=blocked with empty proof evidence/assertions. Reporter and crash finalizer persist the same records.

`targetPreflight` returns the actual Page, fresh targetId, creation ownership and assigned disposable cleanup. `environmentReady` validates continuity and flushed evidence on the executor attachment; the fixture completes it before yielding assignedPage. `target-create`/`target-navigate` are literal existing allowed-effects values. Literal `target` in assignment ownership.disposable permits creation, not automatic cleanup. Normal proof assignments omit `target` from ownership.cleanup. Ordinary proof/test teardown and setup failure preserve observable browser state and never call target disposal. The retained `dispose()` primitive closes only the created page when ownership.cleanup includes `target`, for an explicitly requested lifecycle action before a new cycle needing a clean baseline or at explicit overall verification/browser-session termination under session policy. Reused pages are never closed by preflight.

### ProjectPreflightHook consumer authoring contract

This section carries the complete existing version-1 hook authoring requirements for installed consumers. Public `/contracts` supplies the corresponding types in `dist/src/contracts/index.d.ts`; public `/runtime` supplies the shared fixtures and preflight functions. No source architecture checkout or `examples/` is needed to author a conforming hook. This is the existing hook boundary, not another readiness mechanism.

**Ownership, position and wiring.** Native consumer sources own readiness meaning. The installer generates the deterministic function and integration dependencies under `.verification/integration/` on every install, upgrade and recovery from current Platform requirements and native semantics; previous generated hooks have no preservation or requirement authority. Use it only for applicable deterministic consumer-specific pre-proof readiness checks beyond shared platform coverage or other valid integration. It is separate from a product-proof provider and must not be registered as a product-proof capability. The platform owns reference resolution, compatibility checks, invocation and evidence handling.

The sequence is BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY → existing proof executor. In the shared fixture, worker-scoped `assignedBrowser` runs the hook once after browser attachment and before test-scoped `assignedPage` performs TargetPreflight. Browser/project observations may be reused within the same healthy worker attachment. A new worker reruns setup; a browser restart invalidates earlier hook/target observations and requires a fresh preflight attempt. Use the existing one-worker, `fullyParallel:false`, zero-retry, exclusive-assignment rules; no hook chaining or automatic hook retry occurs.

The caller's runner/fixture `use.preflight.projectPreflightHook` supplies one explicit reference alongside `projectRoot`, `environmentId`, current `assignment` and original `planBytes`; normal product execution also supplies its current manifest. The adoption adapter supplies the existing readiness-only selection while preserving the actual consumer hook configuration. Compose the shared fixture through ordinary `test.extend`, or use the same shared preflight functions through the supported caller path. Supplied plan/assignment/execution identities and assigned host/page configuration must agree before fixture effects; known host escalation is obtained through the caller before restricted host operations. Keep the hook reference outside `.verification/platform.json`. There is no implicit filename discovery, working-directory fallback or global hook lookup; `.verification/integration/preflight.mjs` is only an example. An absent reference records project PASS with `No project hook configured`; it is not evidence for HookNotRequired. A configured missing/invalid hook blocks setup. Adoption requires a source-backed hook decision consistent with the actual configured hook; freshly derive required conditions and regenerate or omit the hook consistently with current authority/native evidence.

**Exact reference and module.** All five reference fields are required; additional keys are rejected:

```ts
type ProjectPreflightHookReference = {
  contractVersion: 1;
  entry: string;
  sha256: string;
  deadlineMs: number;
  input: JsonValue;
};
```

`entry` is a nonempty project-relative JavaScript path ending in `.mjs`, `.cjs` or `.js`. Absolute paths, Windows drive prefixes and backslashes are rejected. `projectRoot` must be explicit and absolute; the platform canonicalizes it and resolves the existing entry through real paths. The resolved entry must be a descendant of that root; escaping through a path or symlink is rejected. `sha256` is exactly 64 lowercase hexadecimal characters matching SHA-256 of the actual entry bytes. The version/reference and digest are checked before import. Do not replace an expected digest merely to bless unexplained edits.

The module exports `contractVersion = 1` and callable `runPreflight(context)`, documented as returning `Promise<ProjectPreflightResult>`; the platform awaits its return. It checks module version/function exports before invocation. Module loading must have no setup side effects. Missing exports, unsupported versions, import errors, exceptions and malformed results produce a project blocker. Runtime never installs/builds a hook automatically.

`deadlineMs` is finite and positive. `input` is JSON data: null, strings, booleans, finite numbers, arrays and plain JSON objects. Functions, live handles and executable commands are outside this input contract. Input carries consumer-owned expected identity/build/configuration, not permission grants or an action language. The platform passes a structured copy.

**Complete provided context and available state.** The context contains these fields:

```ts
type ProjectPreflightContext = {
  contractVersion: 1;
  projectRoot: string;
  environmentId: string;
  executionIdentity: ExecutionIdentity;
  browser: Browser;
  browserProvenance: {
    binary: string; profile: string; version: string;
    process_id: number; started_at: string; webSocketDebuggerUrl: string;
    launched?: boolean;
  };
  input: JsonValue;
  evidenceDirectory: string;
  deadlineMs: number;
  signal: AbortSignal;
};
```

`Browser` is the existing Playwright Browser: attached, borrowed and observation-only. BrowserPreflight must already have recorded PASS/RECOVERED. The platform checks connection and revalidates the current session immediately before the hook and after its result. BrowserProvenance describes the actual configured binary/profile/version and current incarnation, not an alternative browser or future cached endpoint. ExecutionIdentity, provenance and input are copied; the Browser remains an in-memory observation surface and is never serialized.

ExecutionIdentity contains execution ID/attempt, plan/binding/assignment digests, generated-source/fixture digests, provider source identities (ID/version, entry/declaration paths and digests), provider IDs/versions and runtime/build/tool provenance. `projectRoot` is canonical; `environmentId` is current; `evidenceDirectory` is the platform-created, run-owned directory for this hook execution/worker.

There is no assigned Page, ready selected target or guaranteed target identity at hook time: TargetPreflight has not run. Existing pages may be observed through the Browser, but the selected page may be absent and its uniqueness/document readiness is not yet established. The context supplies no host-session disposer or permission-granting callback. PID/start time, WebSocket paths, targets and live handles are current observations, not persistent configuration for later incarnations.

**Bounded execution and effects.** Module loading/invocation is bounded by the configured deadline and caller cancellation. The hook must honor `deadlineMs`/`signal` and dispose its own temporary observation sessions. Timeout/cancellation blocks the attempt; later hook completion cannot promote it to READY. A deadline does not authorize killing Chrome. Preserve the blocked attempt and use existing owned worker/client finalization.

The hook observes readiness and writes evidence. It must not launch/restart/close Chrome, replace targets, create/navigate/reload/close target pages, change the persistent profile/extensions, install/build/enable/reload/replace persistent components, perform setup/remediation, execute product-proof actions or orchestrate other hooks. Preserve borrowed browser/profile/pages and all observable browser state. Temporary observation connections may be disposed without changing that state. The hook is trusted caller-selected code, not a sandbox; these restrictions are contractual, not a read-only Browser wrapper.

Dependencies, when needed, remain explicitly supplied project code with the project's existing source/provenance conventions. Entry digest/confinement does not recursively hash or sandbox imported dependencies; this is not a dependency registry. AI may assist authoring during installation, but normal runtime executes the generated deterministic function rather than making AI readiness decisions.

Required setup/remediation is performed by the installation agent outside the hook under existing authorization. Persistent extension installation/enabling/reload/replacement requires HITL; the hook only reports the need. A hook request grants no permission, and installation permission alone does not grant browser/target/persistent-setup effects. After authorized intervention, rerun affected preflight with fresh observations. Browser cleanup/reset remains an independently authorized lifecycle action.

**Exact result, HITL and evidence.** Return only these result keys; all except conditional `hitl` are required:

```ts
type ProjectPreflightResult = {
  contractVersion: 1;
  status: 'READY' | 'NEEDS_HITL' | 'BLOCKED';
  reason: string;
  evidence: {path: string; sha256: string}[];
  hitl?: {action: string; reason: string};
};
```

`reason` must be nonblank. Each evidence item accepts only `path` and `sha256`: a nonempty path and 64 lowercase hexadecimal digest characters. Referenced files must exist and be readable beneath the supplied hook-specific `evidenceDirectory` after real-path resolution; relative and absolute in-directory paths are accepted, but outside paths/symlinks and the directory itself are rejected. Digest each file's actual bytes. READY requires at least one evidence item establishing the configured checks. NEEDS_HITL/BLOCKED may return an empty array; the array is still required. Observed facts belong in evidence files, not additional result keys. Evidence content/meaning is consumer-owned; the platform validates paths, bytes and identity, not semantic completeness.

NEEDS_HITL requires a `hitl` object containing only nonblank `action` and `reason`. READY/BLOCKED must omit `hitl` entirely; a present `hitl:undefined` is rejected. The installation frontend builds viable resolution alternatives including cancellation; do not add those options to the hook's two-field HITL object.

| Hook result | Existing stage consequence |
| --- | --- |
| READY | Record project PASS, then allow TargetPreflight. This is neither ENVIRONMENT READY nor Product PASS. |
| NEEDS_HITL | Record project BLOCKED, preserve the requested action/reason/evidence, stop target/proof execution and return to caller HITL. Overall installation remains pending. |
| BLOCKED | Record project BLOCKED, preserve reason/evidence and stop target/proof execution. Overall installation remains pending. |

Invalid reference/export/result/evidence, errors, cancellation and timeout also block setup with diagnostics. The hook cannot authorize retry or replace identity during an atomic proof. Successful project readiness still requires subsequent TargetPreflight and the final continuity/evidence gate.

**Validation, recording and callability.** File existence, a valid reference or matching entry digest alone does not establish callability/readiness. The shared path validates surrounding current configuration, then reference/version/root/entry/digest, module export compatibility, bounded execution, exact result/HITL shape, evidence confinement/digests and post-hook session continuity. Result evidence is checked again through preflight persistence/collection. A conforming hook must actually establish its configured readiness conditions with evidence.

The platform records entry SHA-256, input SHA-256, hook status/HITL, timing and evidence under the current execution/environment/worker identity. Browser records supply incarnation provenance. Existing schema-version-1 preflight sidecars use `preflight-<execution-id-hash>-<worker-index>-<sequence>.json` under the output root; the platform supplies these records, so hook authors do not fabricate them. Hook evidence remains in the hook-specific directory, separate from product Evidence/Result. READY without product proof never creates passing product claim records; ordinary proof coverage, reconciliation and human acceptance remain unchanged.
