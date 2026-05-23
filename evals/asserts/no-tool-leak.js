const { getText } = require('./lib');

const FORBIDDEN = [
  'record_caller_email',
  'get_caller_context',
  'check_customer_status',
  'create_ticket',
  'get_call_ticket',
  'schedule_appointment',
  'end_call',
];

module.exports = function noToolLeak(output) {
  const text = getText(output).toLowerCase();
  const leaked = FORBIDDEN.filter((s) => text.includes(s));
  const ok = leaked.length === 0;
  return {
    pass: ok,
    score: ok ? 1 : 0,
    reason: ok ? 'clean' : `leaked: ${leaked.join(', ')}`,
  };
};
