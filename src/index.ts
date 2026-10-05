import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z, ZodError } from 'zod';
import { prisma, warmUp } from './prisma';
import { requireAuth, sign } from './auth';
import { admin, ensureSections, getSettings, h, HttpError, s } from './admin';
import { getCalendar, getGithub, norm, usageMap } from './github';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((x) => x.trim()) }));
app.use(express.json({ limit: '1mb' }));

const loginLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 10, message: { error: 'Too many attempts. Try again later.' } });
const contactLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, message: { error: 'Too many messages. Try again later.' } });
const calendarLimiter = rateLimit({ windowMs: 60_000, limit: 60, message: { error: 'Too many requests.' } });

app.get('/', (_req, res) => { res.json({ ok: true, service: 'portfolio-api' }); });

// ---------- public ----------
app.get('/api/site', h(async (_req, res) => {
  const where = { visible: true };
  const orderBy = [{ order: 'asc' as const }, { id: 'asc' as const }];
  const [profile, sections, stats, skills, projects, experience, posts, settings] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.section.findMany({ where, orderBy }),
    prisma.stat.findMany({ where, orderBy }),
    prisma.skill.findMany({ where, orderBy }),
    prisma.project.findMany({ where, orderBy }),
    prisma.experience.findMany({ where, orderBy }),
    prisma.post.findMany({ where, orderBy }),
    getSettings(),
  ]);

  // GitHub data comes from the saved cache; never make the page wait more than 8 seconds for it
  const github = await Promise.race([getGithub(settings.githubUsername), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
  const usage = usageMap(github);
  const merged = skills.map((k) => {
    const pct = k.source === 'github' ? usage.get(norm(k.name)) : undefined;
    return pct === undefined ? { ...k, auto: false } : { ...k, level: pct, auto: true };
  });

  res.json({ profile, sections, stats, skills: merged, projects, experience, posts, settings, github });
}));

// contribution calendar for one year (year buttons on the site)
app.get('/api/github/calendar', calendarLimiter, h(async (req, res) => {
  const year = String(req.query.year ?? 'last');
  if (year !== 'last' && !/^20\d\d$/.test(year)) throw new HttpError(400, 'Invalid year');
  const { githubUsername } = await getSettings();
  const days = githubUsername ? await getCalendar(githubUsername, year) : null;
  if (!days) throw new HttpError(404, 'No data');
  res.json({ year, days });
}));

const contactSchema = z.object({
  name: s(80).min(1), email: z.string().email().max(120), subject: s(120).optional().default(''),
  message: s(3000).min(5), website: z.string().optional(),
});
app.post('/api/contact', contactLimiter, h(async (req, res) => {
  const d = contactSchema.parse(req.body);
  if (d.website) { res.json({ ok: true }); return; } // honeypot
  await prisma.message.create({ data: { name: d.name, email: d.email, subject: d.subject, message: d.message } });
  res.json({ ok: true });
}));

// Vercel Cron calls this once a day to refresh GitHub data (needs CRON_SECRET env var)
app.get('/api/cron/github', h(async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'Unauthorized');
  const { githubUsername } = await getSettings();
  const g = githubUsername ? await getGithub(githubUsername, true) : null;
  res.json({ ok: !!g });
}));

// ---------- auth + admin ----------
app.post('/api/auth/login', loginLimiter, h(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const a = await prisma.admin.findUnique({ where: { email } });
  if (!a || !(await bcrypt.compare(password, a.passwordHash))) throw new HttpError(401, 'Wrong email or password');
  res.json({ token: sign(a.id) });
}));
app.use('/api/admin', requireAuth, admin);

app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) { res.status(400).json({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }); return; }
  if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
  if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return; }
  if (err?.code === 'P2002') { res.status(409).json({ error: 'Already exists' }); return; }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// locally: start the server. On Vercel the exported app is used as a serverless function.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
    warmUp()
      .then(async () => {
        await ensureSections();
        const { githubUsername } = await getSettings();
        if (githubUsername && (await getGithub(githubUsername))) console.log(`GitHub data ready for @${githubUsername}`);
      })
      .catch((e) => console.error('Startup tasks failed:', e.message));
  });
}

export default app;