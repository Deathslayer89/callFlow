const { getToolCalls, getName, varsFor } = require('./lib');

module.exports = function calledTool(output, context) {
  const { expectedTool } = varsFor(context);
  const calls = getToolCalls(output);
  if (calls.length === 0) return { pass: false, score: 0, reason: 'no tool call emitted' };
  const names = calls.map(getName);
  const ok = names.includes(expectedTool);
  return {
    pass: ok,
    score: ok ? 1 : 0,
    reason: ok ? `called ${expectedTool}` : `called ${names.join(',')} — expected ${expectedTool}`,
  };
};
