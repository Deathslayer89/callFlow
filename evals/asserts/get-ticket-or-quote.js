const { getToolCalls, getName, getText, varsFor } = require('./lib');

module.exports = function getTicketOrQuote(output, context) {
  const { expectedTicketId } = varsFor(context);
  const called = getToolCalls(output).some((c) => getName(c) === 'get_call_ticket');
  if (called) return { pass: true, score: 1, reason: 'called get_call_ticket' };
  const text = (getText(output) || '').toUpperCase();
  const ok = Boolean(expectedTicketId && text.includes(expectedTicketId));
  return {
    pass: ok,
    score: ok ? 1 : 0,
    reason: ok ? 'spoke the ID from context' : 'neither invoked nor spoke ID',
  };
};
