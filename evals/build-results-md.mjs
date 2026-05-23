#!/usr/bin/env node
// Reads evals/results.json (promptfoo eval output) and produces evals/RESULTS.md
// with: per-(model × category) pass-rates, total cost, p50/p95 latency, and a
// short analysis paragraph at the end.
//
// Run via `npm run eval:report` after `npm run eval`.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(here, 'results.json');
const OUT_PATH = join(here, 'RESULTS.md');

// USD per million tokens. Pulled from OpenRouter price pages on 2026-05-22.
// promptfoo doesn't compute costs for OpenRouter-routed calls so we do it here.
const PRICES = {
  'openrouter:openai/gpt-4o-mini': { in: 0.15, out: 0.6 },
  'openrouter:anthropic/claude-haiku-4.5': { in: 1.0, out: 5.0 },
  'openrouter:meta-llama/llama-3.3-70b-instruct': { in: 0, out: 0 }, // :free
  'openrouter:google/gemini-2.5-flash': { in: 0.075, out: 0.3 },
};

const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const rows = raw.results?.results ?? [];

const SKIP_METRIC = 'no_tool_leak'; // global default — bucket separately

const stats = new Map();
const leakStats = new Map();

for (const r of rows) {
  const model = r.provider?.label || r.provider?.id || 'unknown';
  const providerId = r.provider?.id || '';
  const named = r.gradingResult?.namedScores || {};
  const metric = Object.keys(named).find((k) => k !== SKIP_METRIC) || 'other';
  const passed = (named[metric] ?? 0) >= 1;
  const leakPassed = (named[SKIP_METRIC] ?? 1) >= 1;
  const latency = r.latencyMs ?? r.response?.latencyMs ?? 0;
  const usage = r.response?.tokenUsage || {};
  const price = PRICES[providerId] || { in: 0, out: 0 };
  const cost = ((usage.prompt ?? 0) * price.in + (usage.completion ?? 0) * price.out) / 1_000_000;

  if (!stats.has(model)) stats.set(model, new Map());
  const cat = stats.get(model);
  if (!cat.has(metric)) cat.set(metric, { pass: 0, total: 0, latencies: [], costs: [], tokens: 0 });
  const cell = cat.get(metric);
  cell.total += 1;
  if (passed) cell.pass += 1;
  if (latency) cell.latencies.push(latency);
  cell.costs.push(cost);
  cell.tokens += (usage.total ?? 0);

  if (!leakStats.has(model)) leakStats.set(model, { pass: 0, total: 0 });
  const l = leakStats.get(model);
  l.total += 1;
  if (leakPassed) l.pass += 1;
}

const models = [...stats.keys()].sort();
const categories = [
  ...new Set([...stats.values()].flatMap((m) => [...m.keys()])),
].sort();

const fmtPct = (p, t) => (t === 0 ? '—' : `${Math.round((p / t) * 100)}% (${p}/${t})`);
const percentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
};
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

let md = `# Eval results\n\n`;
md += `Suite: ${rows.length} test runs across ${models.length} models, ${new Date().toISOString().slice(0, 10)}.\n\n`;

md += `## Pass rate by model × category\n\n`;
md += `| Model | ` + categories.join(' | ') + ` | no-leak | Overall |\n`;
md += `|---|` + categories.map(() => '---').join('|') + `|---|---|\n`;
for (const m of models) {
  const cat = stats.get(m);
  let totalP = 0, totalT = 0;
  const cells = categories.map((c) => {
    const cell = cat.get(c) ?? { pass: 0, total: 0 };
    totalP += cell.pass; totalT += cell.total;
    return fmtPct(cell.pass, cell.total);
  });
  const leak = leakStats.get(m) ?? { pass: 0, total: 0 };
  md += `| ${m} | ${cells.join(' | ')} | ${fmtPct(leak.pass, leak.total)} | ${fmtPct(totalP, totalT)} |\n`;
}

md += `\n## Cost per run (USD)\n\n`;
md += `| Model | Total cost | Avg / case | Total tokens |\n|---|---|---|---|\n`;
for (const m of models) {
  const cat = stats.get(m);
  const allCosts = [...cat.values()].flatMap((c) => c.costs);
  const total = sum(allCosts);
  const avg = allCosts.length > 0 ? total / allCosts.length : 0;
  const tokens = [...cat.values()].reduce((a, c) => a + c.tokens, 0);
  md += `| ${m} | $${total.toFixed(4)} | $${avg.toFixed(5)} | ${tokens.toLocaleString()} |\n`;
}

md += `\n## Latency (ms)\n\n`;
md += `| Model | p50 | p95 |\n|---|---|---|\n`;
for (const m of models) {
  const cat = stats.get(m);
  const all = [...cat.values()].flatMap((c) => c.latencies);
  md += `| ${m} | ${percentile(all, 0.5)} | ${percentile(all, 0.95)} |\n`;
}

md += `\n## Notes\n\n`;
md += `Generated from \`evals/results.json\`. Open \`evals/results.html\` for case-by-case detail.\n`;
md += `Cost figures are computed from prompt/completion token counts using OpenRouter list prices on the date above — promptfoo doesn't track per-provider costs for OpenRouter-routed calls.\n`;

writeFileSync(OUT_PATH, md);
console.log(`wrote ${OUT_PATH}`);
