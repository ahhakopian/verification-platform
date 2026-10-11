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
    assert.match(text, /(?:BLOCKED[^.]*unresolved project decision|unresolved project decision[^.]*BLOCKED)/i, name);
    assert.match(text, /required human action/i, name);
  }
  assert.match(canonical, /Report platform installation and consumer operational readiness separately/);
  assert.match(canonical, /distribution smoke test proves only platform compatibility/);
  assert.match(canonical, /neither establishes product PASS nor authorizes live acceptance/);
});

test('installation and upgrades derive necessary consumer-owned integration from project obligations', () => {
  for (const [name, text] of guidance) {
    assert.match(text, /install(?:ing|ation)[^.]*upgrad(?:e|ing)/i, name);
    assert.match(text, /existing (?:consumer |verification )?plans\/configuration|existing verification plans\/configuration/, name);
    assert.match(text, /applicable (?:verification )?obligations/, name);
    assert.match(text, /(?:only[^.]*consumer-owned|consumer-owned[^.]*only)/, name);
  }
  assert.match(canonical, /from these installation\/adoption instructions, the pinned Verification Integration Contract and public contracts/);
  assert.match(canonical, /Reuse valid existing integration/);
  assert.match(canonical, /outside the indexed platform distribution/);
  assert.match(canonical, /upgrade must recheck compatibility/);
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
  assert.match(canonical, /checked-in consumer-owned code and the public hook contract/);
});

test('installation guidance encodes no consumer-specific readiness logic', () => {
  for (const [name, text] of guidance) {
    assert.doesNotMatch(text, /Personalizer|RM-02|Gemini|custom-ui|extension ID|extension-specific/i, name);
  }
  assert.match(canonical, /never add consumer-specific behavior to the platform/);
  assert.match(read('README.md'), /\]\(distribution\/README.md#installation-and-consumer-adoption\)/);
  assert.match(read('frontends/verification-orchestrator/SKILL.md'), /<distribution>\/distribution\/README.md/);
});
