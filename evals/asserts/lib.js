// Shared helpers used by every assertion file in this folder.
//
// promptfoo passes different shapes for `output` depending on the provider
// and whether the model emitted text or tool calls. Detect them all:
//   - Array of tool_calls (OpenAI/OpenRouter shape when only tool_calls are returned)
//   - { tool_calls: [...] } or { toolCalls: [...] }
//   - { message: { tool_calls: [...] } } or full chat-completion object
//   - Plain string (text response, no tool calls)

function getToolCalls(output) {
  if (!output) return [];
  if (Array.isArray(output)) {
    // Top-level array — assume it's the tool_calls list.
    return output.filter((c) => c && (c.function || c.name || c.type === 'function'));
  }
  const direct = output.tool_calls || output.toolCalls;
  if (Array.isArray(direct)) return direct;
  if (output.message?.tool_calls) return output.message.tool_calls;
  if (output.choices?.[0]?.message?.tool_calls) return output.choices[0].message.tool_calls;
  return [];
}

function getName(call) {
  return call?.function?.name ?? call?.name ?? call?.functionCall?.name ?? '';
}

function getArgs(call) {
  const raw = call?.function?.arguments ?? call?.arguments ?? call?.functionCall?.arguments;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getText(output) {
  if (!output) return '';
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    // Tool-call-only response — no spoken text.
    return '';
  }
  return (
    output.content ??
    output.text ??
    output.message?.content ??
    output.choices?.[0]?.message?.content ??
    ''
  );
}

function varsFor(context) {
  return context?.test?.vars ?? context?.vars ?? {};
}

module.exports = { getToolCalls, getName, getArgs, getText, varsFor };
