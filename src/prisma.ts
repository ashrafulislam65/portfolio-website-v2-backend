import { PrismaClient } from '@prisma/client';

const base = new PrismaClient();
const RETRY = new Set(['P1001', 'P1002', 'P1008', 'P1017']); // "can't reach database" family (Neon waking up)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// every query is retried a few times if Neon is still waking up
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        for (let i = 0; ; i++) {
          try { return await query(args); }
          catch (e: any) {
            if (i >= 4 || !RETRY.has(e?.code)) throw e;
            await sleep(1500 * (i + 1));
          }
        }
      },
    },
  },
});

// call once at startup: wakes the Neon compute before real requests arrive
export async function warmUp() {
  for (let i = 1; i <= 6; i++) {
    try { await prisma.$queryRaw`SELECT 1`; console.log('Database connected'); return; }
    catch { console.log(`Waiting for database (try ${i}/6)…`); await sleep(2500); }
  }
  console.error('Database still unreachable. Check DATABASE_URL in .env');
}