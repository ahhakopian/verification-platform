'use strict';

async function browserCDP(browser) {
  if (!browser || typeof browser.newBrowserCDPSession !== 'function')
    throw new Error('Existing Playwright browser attachment is required.');
  return browser.newBrowserCDPSession();
}

async function discoverTargets(cdp, filter) {
  if (!Array.isArray(filter) || !filter.length || filter.some(entry =>
    !entry || typeof entry !== 'object' || Array.isArray(entry) ||
    Object.keys(entry).some(key => !['type', 'exclude'].includes(key)) ||
    ('type' in entry && (typeof entry.type !== 'string' || !entry.type)) ||
    ('exclude' in entry && typeof entry.exclude !== 'boolean')))
    throw new Error('Explicit nonempty CDP target filter is required.');
  const { targetInfos } = await cdp.send('Target.getTargets', { filter });
  if (!Array.isArray(targetInfos)) throw new Error('Target discovery returned no target list.');
  return targetInfos;
}

function selectTarget(targets, criteria) {
  const allowed = ['targetId', 'type', 'url', 'title', 'browserContextId', 'openerId'];
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria) ||
      !Object.keys(criteria).length || Object.entries(criteria).some(([key, value]) =>
        !allowed.includes(key) || typeof value !== 'string'))
    throw new Error('Explicit exact target criteria are required.');
  const matches = targets.filter(target => Object.entries(criteria).every(([key, value]) => target[key] === value));
  if (matches.length !== 1) {
    const error = new Error(`Target criteria matched ${matches.length} targets; exactly one is required.`);
    error.code = matches.length ? 'ambiguous' : 'not_found';
    throw error;
  }
  if (!matches[0].targetId) throw new Error('Selected target has no targetId.');
  return matches[0];
}

async function discoverExtension(cdp, extensionId) {
  if (typeof extensionId !== 'string' || !extensionId) throw new Error('Explicit extensionId is required.');
  const { extensions } = await cdp.send('Extensions.getExtensions');
  if (!Array.isArray(extensions)) throw new Error('Extension discovery returned no extension list.');
  const matches = extensions.filter(extension => extension.id === extensionId);
  if (matches.length !== 1) {
    const error = new Error(`Extension ID matched ${matches.length} extensions; exactly one is required.`);
    error.code = matches.length ? 'ambiguous' : 'not_found';
    throw error;
  }
  return matches[0];
}

async function triggerExtensionAction(browser, { extensionId, target } = {}) {
  const record = { status: 'invalid', route: 'browser_level_cdp', extension: null,
    targets: [], selected_target: null, attempted: false, invoked: false,
    command_result: null, protocol_error: null };
  let cdp;
  try {
    if (!target || !target.criteria || (target.criteria.type && target.criteria.type !== 'tab'))
      throw new Error('Extension action requires tab target criteria.');
    cdp = await browserCDP(browser);
    record.extension = await discoverExtension(cdp, extensionId);
    // Chrome protocol invariant: triggerAction accepts only a tab target.
    record.targets = await discoverTargets(cdp, target.filter);
    record.selected_target = selectTarget(record.targets, { ...target.criteria, type: 'tab' });
    if (record.selected_target.type !== 'tab') throw new Error('Extension action rejects non-tab targets.');
    record.attempted = true;
    record.command_result = await cdp.send('Extensions.triggerAction', {
      id: record.extension.id, targetId: record.selected_target.targetId,
    });
    record.invoked = true;
    record.status = 'ok';
  } catch (error) {
    record.status = error.code === 'ambiguous' || error.code === 'not_found' ? error.code : 'error';
    record.protocol_error = { name: error.name, message: error.message,
      ...(error.code !== undefined ? { code: error.code } : {}),
      ...(error.data !== undefined ? { data: error.data } : {}) };
  } finally {
    if (cdp) {
      try { await cdp.detach(); }
      catch (error) { record.cleanup_error = error.message; }
    }
  }
  return record;
}

function renderRunCode(options) {
  const functions = [browserCDP, discoverTargets, selectTarget, discoverExtension, triggerExtensionAction];
  return `async page => { ${functions.map(fn => fn.toString()).join('\n')}
    return triggerExtensionAction(page.context().browser(), ${JSON.stringify(options)}); }`;
}
module.exports = { browserCDP, discoverTargets, selectTarget, discoverExtension, triggerExtensionAction, renderRunCode };
if (require.main === module) {
  const fs = require('node:fs');
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--options') throw new Error('Usage: node extension-action.cjs --options <run options JSON file>');
    process.stdout.write(renderRunCode(JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
