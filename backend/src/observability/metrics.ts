import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { prisma } from '../database/client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests handled by the backend',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const callsStarted = new Counter({
  name: 'calls_started_total',
  help: 'Calls created via the API',
  labelNames: ['source'] as const,
  registers: [registry],
});

// Scrape-time gauges backed by Postgres. Cheaper than in-process counters
// because we don't need to sync state across the backend + worker processes.
new Gauge({
  name: 'workflows_by_status',
  help: 'Workflow rows by status',
  labelNames: ['status'] as const,
  registers: [registry],
  async collect() {
    const rows = await prisma.workflow.groupBy({ by: ['status'], _count: { _all: true } });
    this.reset();
    for (const r of rows) this.set({ status: r.status }, r._count._all);
  },
});

new Gauge({
  name: 'calls_by_status',
  help: 'Call rows by status',
  labelNames: ['status'] as const,
  registers: [registry],
  async collect() {
    const rows = await prisma.call.groupBy({ by: ['status'], _count: { _all: true } });
    this.reset();
    for (const r of rows) this.set({ status: r.status }, r._count._all);
  },
});
