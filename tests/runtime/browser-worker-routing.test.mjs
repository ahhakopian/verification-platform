import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { FIRST_RESPONSE_DEADLINE_MS, retainBrowserAttempt, routeBrowserAttempt } = require('../../frontends/browser-verification/assets/browser-worker-routing.cjs');
const request = { executionId: 'execution', attempt: 1, evidencePath: '/evidence/one.json',
  assignment: 'Bounded claim. No model escalation.', attachment: 'existing', ownership: { cleanup: [] } };
function fixture() {
  const state = retainBrowserAttempt(request, 'medium-task', 100);
  const observation = { workerId: 'medium-task', complete: true, responses: 0, toolDispatches: 0, sideEffects: false };
  const events = [];
  let mediumRunning = true;
  const parent = {
    save(s) { events.push(['save', s.status]); },
    async stop(id) { events.push(['stop', id]); mediumRunning = false; return { workerId: id, terminated: true }; },
    async observe(id) { events.push(['observe', id]); assert.equal(mediumRunning, false); return { ...observation }; },
    async spawn(role, assignment, handoff) {
      assert.equal(mediumRunning, false, 'High must never overlap Medium');
      events.push(['spawn', role, assignment, handoff]); return { workerId: 'high-task' };
    }
  };
  return { state, observation, events, parent, now: state.deadlineAt };
}
const run = f => routeBrowserAttempt(f.state, f.observation, f.now, {}, f.parent);
const spawns = f => f.events.filter(e => e[0] === 'spawn');
test('responsive Medium response or tool dispatch preserves normal routing', async () => {
  for (const field of ['responses', 'toolDispatches']) {
    const f = fixture(); f.observation[field] = 1; f.observation.complete = false; await run(f);
    assert.equal(f.state.role, 'browser_luna'); assert.deepEqual(f.events, []);
  }
});
test('deadline belongs to parent and silent worker stays Medium until deadline', async () => {
  const f = fixture(); assert.equal(FIRST_RESPONSE_DEADLINE_MS, 60_000);
  f.now--; await run(f); assert.deepEqual(f.events, []);
  f.now++; await run(f); assert.equal(f.state.role, 'browser_sol');
});
test('zero response/dispatch stops Medium then hands High the same logical attempt', async () => {
  const f = fixture(); await run(f);
  assert.deepEqual(f.events.filter(e => e[0] !== 'save').map(e => e[0]), ['stop', 'observe', 'spawn']);
  assert.deepEqual(spawns(f)[0][2], request);
  assert.equal(f.state.mediumWorkerId, 'medium-task'); assert.equal(f.state.workerId, 'high-task');
  assert.equal(spawns(f)[0][3].reason, 'first-response-deadline');
  await run(f); assert.equal(spawns(f).length, 1); assert.equal(f.state.request.attempt, 1);
});
test('uncertain telemetry or effects blocks without escalation', async () => {
  for (const patch of [{ complete: false }, { toolDispatches: undefined }, { responses: undefined },
    { sideEffects: undefined }, { sideEffects: true }, { workerId: 'other' }]) {
    const f = fixture(); Object.assign(f.observation, patch); await run(f);
    assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
    assert.equal(f.events.some(e => e[0] === 'stop'), false);
  }
});
test('High is not started until Medium termination is confirmed', async () => {
  const f = fixture(); let release;
  f.parent.stop = () => new Promise(resolve => { release = resolve; });
  const pending = run(f); assert.equal(f.state.status, 'stopping'); assert.equal(spawns(f).length, 0);
  release({ workerId: 'medium-task', terminated: false }); await pending;
  assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
});
test('post-stop dispatch race blocks handoff', async () => {
  const f = fixture(); f.parent.observe = async () => ({ ...f.observation, toolDispatches: 1 });
  await run(f); assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
});
test('explicit technical ambiguity still escalates with prior effects/evidence', async () => {
  const f = fixture(); f.now = 101;
  Object.assign(f.observation, { escalation: 'ESCALATE: browser_sol', responses: 1, toolDispatches: 2, sideEffects: true });
  await run(f); assert.equal(f.state.role, 'browser_sol');
  assert.equal(spawns(f)[0][3].reason, 'technical-ambiguity');
  assert.deepEqual(spawns(f)[0][2], request);
});
test('caller-generated no-escalation instruction cannot disable routing', async () => {
  const f = fixture(); await run(f); assert.equal(spawns(f).length, 1);
});
test('explicit platform/user disable policy blocks escalation', async () => {
  const f = fixture(); await routeBrowserAttempt(f.state, f.observation, f.now, { modelEscalationDisabled: true }, f.parent);
  assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
});
test('lost spawn outcome never creates duplicate attempt or redispatch', async () => {
  const f = fixture(); let calls = 0;
  f.parent.spawn = async () => { calls++; throw Error('lost result'); };
  await run(f); await run(f); assert.equal(calls, 1); assert.equal(f.state.status, 'BLOCKED');
  assert.deepEqual(f.state.request, request);
});
test('restored in-progress handoff blocks rather than spawning again', async () => {
  for (const status of ['stopping', 'handing-off']) {
    const f = fixture(); f.state.status = status; await run(f);
    assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
  }
});
test('concurrent routing cannot dispatch High while Medium stop is pending', async () => {
  const f = fixture(); const originalStop = f.parent.stop; let release;
  f.parent.stop = async id => { await new Promise(resolve => { release = resolve; }); return originalStop(id); };
  const pending = run(f);
  await run(f); assert.equal(f.state.status, 'BLOCKED'); assert.equal(spawns(f).length, 0);
  release(); await pending; assert.equal(spawns(f).length, 0);
});
test('rendered helper is usable by tools-only parent', () => {
  const source = execFileSync(process.execPath, [require.resolve('../../frontends/browser-verification/assets/browser-worker-routing.cjs'), '--render'], { encoding: 'utf8' });
  const helper = eval(source);
  assert.deepEqual(helper.retainBrowserAttempt(request, 'medium-task', 100), retainBrowserAttempt(request, 'medium-task', 100));
});
