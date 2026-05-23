// USD per million tokens. Extend as more models get used.
const PRICES: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'deepseek/deepseek-chat-v3-0324:free': { in: 0, out: 0 },
};

function priceFor(model: string) {
  return PRICES[model] ?? PRICES[model.split('/').pop() ?? ''] ?? { in: 0, out: 0 };
}

export function computeCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = priceFor(model);
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
