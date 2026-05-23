const { getToolCalls, getName } = require('./lib');

module.exports = function calledNoTool(output) {
  const calls = getToolCalls(output);
  const ok = calls.length === 0;
  return {
    pass: ok,
    score: ok ? 1 : 0,
    reason: ok ? 'no tool call' : `unexpected: ${calls.map(getName).join(',')}`,
  };
};
