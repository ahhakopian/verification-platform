import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const canonical = read('distribution/README.md').split('## Installation and consumer adoption\n')[1];
const guidance = [
  ['distribution instructions', canonical],
  ['integration contract', read('contracts/verification-integration.md')],
  ['AI entry guidance', read('README.md')],
  ['AI frontend guidance', read('frontends/verification-orchestrator/SKILL.md')],
];

test('installation-only state cannot complete adoption', () => {
  assert.ok(canonical, 'the shipped README must contain the canonical adoption procedure');
  for (const [name, text] of guidance) {
    assert.match(text, /(?:alone cannot establish adoption PASS|alone is installation-only state|Installation-only state cannot receive adoption PASS)/, name);
  }
  assert.match(canonical, /Copying release files, binding the release, validating integrity, or installing frontend skills\/agents alone/);
});

test('adoption PASS requires operational readiness and unresolved readiness is BLOCKED', () => {
  for (const [name, text] of guidance) {
    assert.match(text, /PASS (?:only when|requires)[^.]*operational(?:ly)? read(?:y|iness)/, name);
    assert.match(text, /BLOCKED/i, name);
    assert.match(text, /required human action|external actions/i, name);
  }
  assert.match(canonical, /report platform installation and consumer operational readiness separately/i);
  assert.match(canonical, /distribution smoke test proves only platform compatibility/);
  assert.match(canonical, /neither establishes product PASS nor authorizes live acceptance/);
});

test('installation, upgrade and recovery regenerate installer-owned integration from current authorities', () => {
  for (const [name, text] of [...guidance,['packaged workflow',read('frontends/verification-orchestrator/assets/installation-adoption.md')]]) {
    for(const requirement of [
      /Platform defines WHAT consumer integration must satisfy; the AI installer determines HOW/,
      /Native consumer code\/configuration is the semantic authority/,
      /every install, upgrade and recovery, freshly regenerate/,
      /All integration-only files[^.]*auxiliary bridges/,
      /installer-owned generated output in this single directory/,
      /Previous generated integration has no preservation or requirement authority/,
      /Autonomously adapt\/wrap\/bridge\/rewire technical incompatibilities within existing authorization/,
      /Reconcile active dispatches and reserved correction postconditions before replacing code/,
      /Recovery must freshly derive integration even after a completed configuration stage/,
      /changed sources\/configuration require fresh affected checks/,
    ]) assert.match(text,requirement,name);
    assert.ok(text.includes('`.verification/integration/`'),name);
    assert.doesNotMatch(text,/Reuse valid existing integration|preserve valid integration|one-correction|permitted correction/);
  }
  assert.match(canonical, /planned references alone are insufficient/);
});

test('ProjectPreflightHook is conditional consumer integration, never a universal adoption requirement', () => {
  for (const [name, text] of guidance) {
    assert.match(text, /ProjectPreflightHook (?:remains |is )?optional/, name);
    assert.match(text, /only when[^.]*deterministic project-specific readiness checks|needed only for deterministic project-specific readiness checks/, name);
  }
  assert.match(canonical, /never universally required/);
  assert.match(canonical, /If no such checks are needed, omit the hook/);
  assert.match(canonical, /consumer runner\/fixture configuration[^.]*never from the neutral platform binding/);
  assert.match(canonical, /generated installer-owned code[^\n]*and the public hook contract/);
});

test('installation guidance encodes no consumer-specific readiness logic', () => {
  for (const [name, text] of guidance) {
    assert.doesNotMatch(text, /Personalizer|RM-02|Gemini|custom-ui|extension ID|extension-specific/i, name);
  }
  assert.match(canonical, /never add consumer-specific behavior to the platform/);
  assert.match(read('README.md'), /\]\(distribution\/README.md#installation-and-consumer-adoption\)/);
  assert.match(read('frontends/verification-orchestrator/SKILL.md'), /<distribution>\/distribution\/README.md/);
});

test('installation waits for resolution or explicit cancellation instead of terminating on intermediate blockers', () => {
  const surfaces = [...guidance.filter(([name]) => name !== 'AI entry guidance'),
    ['packaged workflow', read('frontends/verification-orchestrator/assets/installation-adoption.md')]];
  for (const [name, text] of surfaces) {
    assert.match(text, /nonterminal/, name);
    assert.match(text, /concrete viable resolution options/, name);
    assert.match(text, /cancel(?:lation)? (?:of )?the entire Verifier installation/, name);
    assert.match(text, /wait(?:ing)? for (?:an explicit |the )user(?:'s)? (?:actual )?decision/i, name);
    assert.match(text, /implement(?:s)? (?:it|that option|the approved (?:non-cancel )?option)/i, name);
    assert.match(text, /outside the (?:observation-only )?(?:ProjectPreflightHook|hook)/, name);
  }
});

test('public hook authoring authority carries existing shapes, boundaries and lifecycle requirements', () => {
  const contract = read('contracts/contracts.md').split('### ProjectPreflightHook consumer authoring contract\n')[1];
  assert.ok(contract, 'complete hook authority must be in the shipped public contract');
  for (const [type, fields] of [
    ['ProjectPreflightHookReference', ['contractVersion', 'entry', 'sha256', 'deadlineMs', 'input']],
    ['ProjectPreflightContext', ['contractVersion', 'projectRoot', 'environmentId', 'executionIdentity', 'browser', 'browserProvenance', 'input', 'evidenceDirectory', 'deadlineMs', 'signal']],
    ['ProjectPreflightResult', ['contractVersion', 'status', 'reason', 'evidence', 'hitl']],
  ]) {
    const block = contract.match(new RegExp('type ' + type + ' = \\{([\\s\\S]*?)\\n\\};'))?.[1];
    assert.ok(block, type);
    for (const field of fields) assert.match(block, new RegExp('\\b' + field + '\\??:'), `${type}.${field}`);
  }
  const obligations = [
    /Native consumer sources own readiness meaning/,
    /BrowserPreflight → optional ProjectPreflightHook → TargetPreflight → ENVIRONMENT READY/,
    /worker-scoped[^.]*runs the hook once/,
    /use\.preflight\.projectPreflightHook/,
    /Keep the hook reference outside `\.verification\/platform\.json`/,
    /additional keys are rejected/,
    /Absolute paths, Windows drive prefixes and backslashes are rejected/,
    /escaping through a path or symlink is rejected/,
    /64 lowercase hexadecimal characters matching SHA-256/,
    /module exports `contractVersion = 1` and callable `runPreflight\(context\)`/,
    /Module loading must have no setup side effects/,
    /finite numbers, arrays and plain JSON objects/,
    /Functions, live handles and executable commands are outside/,
    /revalidates the current session immediately before the hook and after its result/,
    /no assigned Page, ready selected target or guaranteed target identity/,
    /must honor `deadlineMs`\/`signal` and dispose its own temporary observation sessions/,
    /later hook completion cannot promote it to READY/,
    /deadline does not authorize killing Chrome/,
    /must not launch\/restart\/close Chrome/,
    /perform setup\/remediation, execute product-proof actions or orchestrate other hooks/,
    /Dependencies[^.]*explicitly supplied project code/,
    /not recursively hash or sandbox imported dependencies/,
    /installation agent outside the hook under existing authorization/,
    /NEEDS_HITL requires a `hitl` object containing only nonblank `action` and `reason`/,
    /READY\/BLOCKED must omit `hitl` entirely/,
    /beneath the supplied hook-specific `evidenceDirectory` after real-path resolution/,
    /READY requires at least one evidence item establishing the configured checks/,
    /NEEDS_HITL\/BLOCKED may return an empty array/,
    /Record project PASS, then allow TargetPreflight/,
    /stop target\/proof execution and return to caller HITL/,
    /File existence[^.]*alone does not establish callability\/readiness/,
    /records entry SHA-256, input SHA-256, hook status\/HITL, timing and evidence/,
    /READY without product proof never creates passing product claim records/,
  ];
  for (const obligation of obligations) assert.match(contract, obligation);
  assert.doesNotMatch(contract, /\]\([^)]*(?:docs\/architecture|examples\/)/);
});

test('both packaged installation entry points explicitly deliver the public hook authoring authority', () => {
  assert.match(canonical, /\[ProjectPreflightHook consumer authoring contract\]\(\.\.\/contracts\/contracts\.md#projectpreflighthook-consumer-authoring-contract\)/);
  const workflow = read('frontends/verification-orchestrator/assets/installation-adoption.md');
  assert.match(workflow, /Before authoring or updating a consumer hook, read `<distribution>\/contracts\/contracts\.md`/);
  assert.match(workflow, /section \*\*ProjectPreflightHook consumer authoring contract\*\*/);
  assert.match(read('frontends/verification-orchestrator/SKILL.md'), /\]\(assets\/installation-adoption\.md\)/);
});

const hitlGuidance = [
  ['distribution instructions', canonical],
  ['AI frontend guidance', read('frontends/verification-orchestrator/SKILL.md')],
  ['packaged workflow', read('frontends/verification-orchestrator/assets/installation-adoption.md')],
];

test('HITL refinement packaged guidance requires autonomous resolution and sequential outcome decisions', () => {
  for (const [name, text] of hitlGuidance) {
    for (const requirement of [
      /Before HITL, exhaust safe and authorized autonomous resolution/,
      /reuse authoritative configuration, derive selected values, discover supported current state/,
      /create\/update installer-owned integration within existing authority/,
      /Do not request discoverable\/derivable raw technical values/,
      /exactly one current unresolved user-owned issue/,
      /Investigate the actual available solutions first and present concrete outcome choices/,
      /Each non-cancel option states its outcome, material consequences and the installer's technical implementation within verified authorization/,
      /exactly one cancellation option whose description is exactly \*\*Cancel Verifier installation\*\*/,
      /Skip, Ignore, Continue partially configured and Continue without required readiness are invalid readiness-bypass substitutes/,
      /identify the missing prerequisite, external action and owner/,
      /Keep the request pending until the user reports completion/,
      /then the installer must discover and validate the resulting state before advancing/,
      /Do not request transcription of discoverable technical details/,
      /persist the matching resolution before implementing installer-owned work/,
      /After every autonomous or user-approved resolution, validate and reassess before any subsequent HITL/,
      /selected outcomes may determine several derived values and eliminate later questions/,
      /Reuse unaffected valid evidence and allocate fresh affected checks when required/,
    ]) assert.match(text, requirement, name);
  }
});

test('HITL refinement packaged caller boundary requires exclusive presentation and return/wait', () => {
  for (const [name, text] of hitlGuidance) {
    assert.match(text, /actual outgoing interaction boundary[^\n]*`adoptionResumeAction`\/`pendingHITL`/, name);
    assert.match(text, /pending HITL → emit\/present only the recorded current HITL → return and wait; otherwise → normal report/, name);
    assert.match(text, /HITL branch must not fall through to normal reporting/, name);
    assert.match(text, /never mix progress\/results with a HITL response/, name);
    assert.match(text, /Keep detailed progress\/diagnostics in existing evidence and report them separately after resolution/, name);
    assert.match(text, /On resume, present the restored request unchanged and wait for the explicit decision or requested external-action completion report/, name);
    assert.match(text, /delegates emission to the AI\/caller; checkpoint validation cannot control arbitrary caller prose/, name);
  }
  // These are the owned contract boundaries; actual caller emission is external.
  for (const path of ['frontends/verification-orchestrator/SKILL.md', 'frontends/verification-orchestrator/assets/installation-adoption.md'])
    assert.equal(read(`dist/${path}`), read(path), `${path} must ship unchanged`);
});
