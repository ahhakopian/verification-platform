'use strict';

// Parent-owned routing only. No timer, browser operation, retry or model override.
const FIRST_RESPONSE_DEADLINE_MS = 60_000;
function retainBrowserAttempt(request, workerId, startedAt) {
  if (!request?.executionId || !Number.isInteger(request.attempt) || request.attempt < 1 ||
      !workerId || !Number.isFinite(startedAt)) throw Error('Attempt and worker identity required');
  return { request: structuredClone(request), workerId, mediumWorkerId: workerId,
    startedAt, deadlineAt: startedAt + FIRST_RESPONSE_DEADLINE_MS,
    role: 'browser_luna', status: 'running' };
}

async function routeBrowserAttempt(state, observation, now, policy, parent) {
  const block = reason => { state.status = 'BLOCKED'; state.reason = reason; parent.save(state); return state; };
  const matches = o => o?.workerId === state.workerId && o.complete === true;
  const zero = o => matches(o) && o.responses === 0 && o.toolDispatches === 0 && o.sideEffects === false;
  if (state.status === 'stopping' || state.status === 'handing-off')
    return block('Interrupted or concurrent handoff; do not spawn again');
  if (state.status !== 'running' || state.role !== 'browser_luna') return state;
  const explicit = observation?.escalation === 'ESCALATE: browser_sol';
  if (!explicit && Number.isFinite(now) && now < state.deadlineAt) return state;
  if (observation?.workerId !== state.workerId) return block('Worker observation identity unavailable');
  if (!explicit && (observation.responses > 0 || observation.toolDispatches > 0)) return state;
  if (!matches(observation)) return block('Authoritative worker observation unavailable');
  if (!explicit && !zero(observation)) return block('Dispatch or browser side effects uncertain');
  if (!Number.isFinite(now)) return block('Parent monotonic clock unavailable');
  // Caller assignment text is deliberately never consulted as routing policy.
  if (policy?.modelEscalationDisabled === true) return block('Platform/user policy disables model escalation');
  state.status = 'stopping';
  state.handoffReason = explicit ? 'technical-ambiguity' : 'first-response-deadline';
  parent.save(state); // Claim handoff before await; re-entry cannot start another worker.
  try {
    const stopped = await parent.stop(state.workerId);
    if (state.status === 'BLOCKED') return state;
    if (stopped?.workerId !== state.workerId || stopped.terminated !== true)
      return block('Medium termination not confirmed');
    const finalObservation = await parent.observe(state.workerId);
    if (state.status === 'BLOCKED') return state;
    if (!matches(finalObservation) || (!explicit && !zero(finalObservation)))
      return block('Final dispatch/side-effect state uncertain or changed during stop');
    state.status = 'handing-off';
    parent.save(state); // Lost spawn outcome must never cause a second spawn.
    const high = await parent.spawn('browser_sol', structuredClone(state.request), {
      previousWorkerId: state.mediumWorkerId, reason: state.handoffReason,
      observation: finalObservation
    });
    if (!high?.workerId || high.workerId === state.mediumWorkerId)
      return block('High worker identity unavailable');
    state.workerId = high.workerId;
    state.role = 'browser_sol';
    state.status = 'running';
    parent.save(state);
    return state;
  } catch (error) {
    return block('Handoff outcome unavailable: ' + String(error));
  }
}
module.exports = { FIRST_RESPONSE_DEADLINE_MS, retainBrowserAttempt, routeBrowserAttempt };
if (require.main === module) {
  if (process.argv[2] !== '--render') throw Error('Usage: browser-worker-routing.cjs --render');
  process.stdout.write('({FIRST_RESPONSE_DEADLINE_MS:' + FIRST_RESPONSE_DEADLINE_MS +
    ',retainBrowserAttempt:' + retainBrowserAttempt.toString().replaceAll('FIRST_RESPONSE_DEADLINE_MS', String(FIRST_RESPONSE_DEADLINE_MS)) +
    ',routeBrowserAttempt:' + routeBrowserAttempt.toString() + '})\n');
}
