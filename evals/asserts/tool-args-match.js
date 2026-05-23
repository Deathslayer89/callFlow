const { getToolCalls, getName, getArgs, varsFor } = require('./lib');

module.exports = function toolArgsMatch(output, context) {
  const { expectedTool, expectedArgs = {} } = varsFor(context);
  const calls = getToolCalls(output);
  const target = calls.find((c) => getName(c) === expectedTool);
  if (!target) {
    return { pass: false, score: 0, reason: `${expectedTool} was not called` };
  }
  const got = getArgs(target);
  for (const [key, val] of Object.entries(expectedArgs)) {
    if (val && typeof val === 'object' && val.regex) {
      const re = new RegExp(val.regex, val.flags ?? 'i');
      if (!re.test(String(got[key] ?? ''))) {
        return {
          pass: false,
          score: 0,
          reason: `args.${key} = "${got[key]}" did not match /${re.source}/`,
        };
      }
    } else if (got[key] !== val) {
      return {
        pass: false,
        score: 0,
        reason: `args.${key} = ${JSON.stringify(got[key])} (want ${JSON.stringify(val)})`,
      };
    }
  }
  return { pass: true, score: 1, reason: `${expectedTool} args match` };
};
