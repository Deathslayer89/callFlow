const { getToolCalls, getName, getText } = require('./lib');

module.exports = function noBalanceFabrication(output) {
  const called = getToolCalls(output).some((c) => getName(c) === 'check_customer_status');
  if (called) return { pass: true, score: 1, reason: 'called check_customer_status' };
  const text = getText(output).toLowerCase();
  const looksLikeNumber = /\$\d|balance is \d|you owe \d/.test(text);
  return {
    pass: !looksLikeNumber,
    score: looksLikeNumber ? 0 : 1,
    reason: looksLikeNumber ? 'fabricated a balance' : 'declined to quote without tool',
  };
};
