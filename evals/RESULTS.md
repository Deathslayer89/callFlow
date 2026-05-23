# Eval results

Suite: 120 test runs across 4 models, 2026-05-22.

## Pass rate by model × category

| Model | email_norm | intent | multi_turn | refusal | tool_args | no-leak | Overall |
|---|---|---|---|---|---|---|---|
| claude-haiku-4.5 | 100% (5/5) | 88% (7/8) | 80% (4/5) | 100% (5/5) | 43% (3/7) | 97% (29/30) | 80% (24/30) |
| gemini-2.5-flash | 100% (5/5) | 88% (7/8) | 80% (4/5) | 100% (5/5) | 86% (6/7) | 100% (30/30) | 90% (27/30) |
| gpt-4o-mini | 60% (3/5) | 75% (6/8) | 40% (2/5) | 100% (5/5) | 71% (5/7) | 100% (30/30) | 70% (21/30) |
| llama-3.3-70b | 80% (4/5) | 100% (8/8) | 100% (5/5) | 40% (2/5) | 100% (7/7) | 100% (30/30) | 87% (26/30) |

## Cost per run (USD)

| Model | Total cost | Avg / case | Total tokens |
|---|---|---|---|
| claude-haiku-4.5 | $0.0764 | $0.00255 | 68,553 |
| gemini-2.5-flash | $0.0031 | $0.00010 | 40,463 |
| gpt-4o-mini | $0.0065 | $0.00022 | 40,762 |
| llama-3.3-70b | $0.0000 | $0.00000 | 57,626 |

## Latency (ms)

| Model | p50 | p95 |
|---|---|---|
| claude-haiku-4.5 | 1693 | 2630 |
| gemini-2.5-flash | 992 | 1480 |
| gpt-4o-mini | 1246 | 2126 |
| llama-3.3-70b | 1034 | 2012 |

## Read

gemini-2.5-flash is the pick for this agent: top overall pass rate, lowest
latency, and effectively free. gpt-4o-mini was the surprise — the default
everyone reaches for came last, mostly on multi-turn (it loses track of detail
accumulated over earlier turns). llama-3.3-70b is the sharpest tool-caller in
the set (perfect on intent, args, and multi-turn) but refuses only 40% of the
out-of-scope and injection prompts, so it's not safe to ship customer-facing
without a separate guardrail. claude-haiku-4.5 is solid but the priciest by an
order of magnitude and weak on argument extraction here.

Still broken across the board: refusals on llama, and argument extraction is
shakier than intent everywhere — getting the right tool is easier than filling
it correctly.

## Notes

Generated from `evals/results.json`. Open `evals/results.html` for case-by-case detail.
Cost figures are computed from prompt/completion token counts using OpenRouter
list prices on the date above; promptfoo doesn't track per-provider costs for
OpenRouter-routed calls.
