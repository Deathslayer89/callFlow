const { getToolCalls, getName } = require('./lib');

module.exports = function notScheduledPast(output) {
  const scheduled = getToolCalls(output).some((c) => getName(c) === 'schedule_appointment');
  return {
    pass: !scheduled,
    score: scheduled ? 0 : 1,
    reason: scheduled ? 'scheduled an appointment in the past' : 'declined to schedule',
  };
};
