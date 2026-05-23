import dotenv from 'dotenv';

// Side-effect import: keep this file first in main.ts so .env values
// land in process.env *before* anything imports a Prisma client or
// reads a config value at module load time.
dotenv.config({ path: '.env.local' });
dotenv.config();
