import dotenv from 'dotenv';

dotenv.config();

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '3000', 10),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // OpenRouter is an OpenAI-compatible aggregator. `:free` models cost
  // nothing but are rate-limited.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  chatModel: process.env.CHAT_MODEL ?? 'deepseek/deepseek-chat-v3-0324:free',

  livekit: {
    url: process.env.LIVEKIT_URL ?? '',
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
  },

  apiKey: process.env.API_KEY ?? '',

  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.RESEND_FROM_EMAIL ?? 'support@example.com',
    to: process.env.RESEND_TO_EMAIL ?? '',
  },
};
