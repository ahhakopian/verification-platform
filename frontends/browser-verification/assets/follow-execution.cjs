'use strict';

// Codex tool orchestration only: one caller-identified attempt, one launch.
// The store is supplied by the execution cell (get: load, set: store).
async function followExecutionAttempt(tools, storage, request, mode = 'follow', onUpdate = () => {}) {
  if (!request || !request.executionId || !Number.isInteger(request.attempt) || request.attempt < 1 || !request.evidencePath || !request.command || !request.command.cmd)
    throw Error('Explicit execution identity, command and evidence path required');
  const key = 'browser-execution:' + request.executionId + ':' + request.attempt;
  const signature = JSON.stringify(request);
  let state = storage.get(key);
  const save = () => { storage.set(key, JSON.parse(JSON.stringify(state))); };
  const block = reason => { state.status = 'blocked'; state.reason = reason; save(); return state; };
  if (state && state.signature !== signature) throw Error('Attempt command/evidence identity changed; explicit new attempt required');
  if (!state) {
    state = { executionId: request.executionId, attempt: request.attempt, evidencePath: request.evidencePath, signature, status: 'launching', sessionId: null, output: '', exitCode: null };
    save(); // Before dispatch: interruption cannot authorize another launch.
    if (mode !== 'start') return block('Execution handle/state unavailable; do not relaunch this attempt');
  } else if (state.status === 'complete' || state.status === 'blocked') {
    return state;
  } else if (state.status === 'launching') {
    return block('Launch outcome/handle unavailable; do not relaunch this attempt');
  }
  const observe = result => {
    if (!result || typeof result !== 'object') return block('Execution returned no usable handle or terminal result');
    if (typeof result.output === 'string') state.output += result.output;
    if (Object.prototype.hasOwnProperty.call(result, 'exit_code')) {
      state.status = 'complete'; state.exitCode = result.exit_code; save(); onUpdate(state); return state;
    }
    if (!Number.isInteger(result.session_id) || (state.sessionId !== null && result.session_id !== state.sessionId))
      return block('Execution session handle missing or changed; do not relaunch');
    state.sessionId = result.session_id; state.status = 'running'; save();
    if (result.output) onUpdate(state);
    return state;
  };
  if (state.status === 'launching') {
    try { observe(await tools.exec_command(request.command)); }
    catch (error) { return block('Launch failed or outcome unknown: ' + String(error)); }
  }
  while (state.status === 'running') {
    const sessionId = state.sessionId;
    if (!Number.isInteger(sessionId)) return block('Execution handle lost; do not relaunch');
    try { observe(await tools.write_stdin({ session_id: sessionId, chars: '', yield_time_ms: 1000, max_output_tokens: 2000 })); }
    catch (error) { return block('Cannot follow execution handle: ' + String(error)); }
  }
  return state;
}

function acceptAttemptEvidence(state, evidence, sourcePath) {
  if (!state || state.status !== 'complete') throw Error('Terminal execution required before evidence collection');
  if (sourcePath !== state.evidencePath) throw Error('Evidence path belongs to a different execution attempt');
  if (!evidence || evidence.executionId !== state.executionId || evidence.attempt !== state.attempt)
    throw Error('Evidence belongs to a different execution attempt');
  return evidence;
}
module.exports = { followExecutionAttempt, acceptAttemptEvidence };
if (require.main === module) {
  if (process.argv[2] !== '--render') throw Error('Usage: follow-execution.cjs --render');
  // Self-contained source usable in the tools-only V8 execution cell.
  process.stdout.write('({followExecutionAttempt:' + followExecutionAttempt.toString() + ',acceptAttemptEvidence:' + acceptAttemptEvidence.toString() + '})\n');
}
