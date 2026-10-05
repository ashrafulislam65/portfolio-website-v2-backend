import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from './prisma';
import { getGithub } from './github';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
// forward async errors to the error middleware (Express 4)
export const h = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const s = (n = 500) => z.string().max(n);
export const url = z.string().max(500).refine((v) => v === '' || /^https?:\/\//.test(v), 'Must start with http:// or https://');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #8b5cf6');
const common = { order: z.number().int().optional(), visible: z.boolean().optional() };

export const BUILTIN = ['about', 'skills', 'projects', 'experience', 'blogs', 'contact', 'github', 'contributions'];

// list resources: one generic CRUD for all of them
const resources: Record<string, { model: any; schema: z.ZodObject<any> }> = {
  sections: { model: prisma.section, schema: z.object({ key: z.string().regex(/^[a-z0-9-]{1,40}$/), title: s(80), subtitle: s(160), body: s(8000), ...common }) },
  stats: { model: prisma.stat, schema: z.object({ label: s(80), value: z.number().int(), ...common }) },
  skills: { model: prisma.skill, schema: z.object({ group: s(60), name: s(60), level: z.number().int().min(0).max(100), source: z.enum(['manual', 'github']), icon: s(40), ...common }) },
  projects: { model: prisma.project, schema: z.object({ title: s(120), category: s(60), year: s(10), featured: z.boolean(), description: s(2000), image: url, tags: z.array(s(40)).max(20), live: url, repo: url, ...common }) },
  experience: { model: prisma.experience, schema: z.object({ role: s(120), org: s(120), period: s(60), points: z.array(s(400)).max(20), ...common }) },
  posts: { model: prisma.post, schema: z.object({ title: s(160), date: s(30), summary: s(600), link: url, ...common }) },
};

const profileSchema = z.object({
  name: s(80).min(1), title: s(120), roles: z.array(s(60)).max(10), tagline: s(300), bio: s(5000),
  photo: url, email: s(120), phone: s(40), location: s(80), github: url, linkedin: url, whatsapp: url, resume: url, status: s(80),
});
const settingsSchema = z.object({
  accent: hex, accent2: hex, siteTitle: s(80), footer: s(200),
  githubUsername: z.string().max(39).regex(/^[A-Za-z0-9-]*$/, 'GitHub username: letters, numbers and dashes only'),
});

export async function getSettings() {
  const rows = (await prisma.setting.findMany()).filter((r) => !r.key.startsWith('_')); // "_" keys are internal (GitHub cache)
  return { accent: '#8b5cf6', accent2: '#22d3ee', siteTitle: 'Portfolio', footer: '', githubUsername: '', ...Object.fromEntries(rows.map((r) => [r.key, r.value])) } as z.infer<typeof settingsSchema>;
}

// adds sections introduced after the first seed (e.g. "github") without touching existing ones
// adds sections introduced after the first seed, placed right before "Contact"
export async function ensureSections() {
  const rows = await prisma.section.findMany({ select: { key: true, order: true } });
  const have = new Set(rows.map((x) => x.key));
  const contact = rows.find((x) => x.key === 'contact');
  const missing = [
    { key: 'contributions', title: 'Contributions', subtitle: 'GitHub activity' },
    { key: 'github', title: 'GitHub', subtitle: 'Open-source activity' },
  ].filter((x) => !have.has(x.key));
  let at = contact ? contact.order : rows.length;
  for (const sec of missing) {
    if (contact) await prisma.section.updateMany({ where: { order: { gte: at } }, data: { order: { increment: 1 } } });
    await prisma.section.create({ data: { ...sec, order: at } });
    at += 1;
  }
}

const pick = (name: string) => {
  const r = resources[name];
  if (!r) throw new HttpError(404, 'Unknown resource');
  return r;
};
const num = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, 'Invalid id');
  return n;
};

export const admin = Router();

admin.get('/summary', h(async (_req, res) => {
  const [projects, skills, experience, posts, sections, unread, messages] = await Promise.all([
    prisma.project.count(), prisma.skill.count(), prisma.experience.count(), prisma.post.count(),
    prisma.section.count(), prisma.message.count({ where: { read: false } }), prisma.message.count(),
  ]);
  res.json({ projects, skills, experience, posts, sections, unread, messages });
}));

admin.get('/profile', h(async (_req, res) => { res.json(await prisma.profile.findUnique({ where: { id: 1 } })); }));
admin.put('/profile', h(async (req, res) => {
  const d = profileSchema.parse(req.body);
  res.json(await prisma.profile.upsert({ where: { id: 1 }, update: d, create: { id: 1, ...d } }));
}));

admin.get('/settings', h(async (_req, res) => { res.json(await getSettings()); }));
admin.put('/settings', h(async (req, res) => {
  const d = settingsSchema.parse(req.body);
  await Promise.all(Object.entries(d).map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })));
  if (d.githubUsername) void getGithub(d.githubUsername, true); // refresh GitHub data in the background
  res.json(d);
}));

// force a fresh GitHub sync (button in Theme & site)
admin.post('/github/refresh', h(async (_req, res) => {
  const { githubUsername } = await getSettings();
  if (!githubUsername) throw new HttpError(400, 'Save your GitHub username first');
  const g = await getGithub(githubUsername, true);
  if (!g) throw new HttpError(502, 'Could not read GitHub. Check the username, or add GITHUB_TOKEN if rate limited.');
  res.json({ ok: true, repos: g.repos, stars: g.stars, contributions: g.contributions, technologies: Object.keys(g.techUsage).length });
}));

admin.get('/messages', h(async (_req, res) => { res.json(await prisma.message.findMany({ orderBy: { createdAt: 'desc' } })); }));
admin.patch('/messages/:id', h(async (req, res) => { res.json(await prisma.message.update({ where: { id: req.params.id }, data: { read: true } })); }));
admin.delete('/messages/:id', h(async (req, res) => { await prisma.message.delete({ where: { id: req.params.id } }); res.json({ ok: true }); }));

admin.get('/:r', h(async (req, res) => {
  res.json(await pick(req.params.r).model.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }));
}));
admin.post('/:r/reorder', h(async (req, res) => {
  const { model } = pick(req.params.r);
  const { ids } = z.object({ ids: z.array(z.number().int()).max(500) }).parse(req.body);
  await Promise.all(ids.map((id, order) => model.update({ where: { id }, data: { order } })));
  res.json({ ok: true });
}));
admin.post('/:r', h(async (req, res) => {
  const { model, schema } = pick(req.params.r);
  const d = schema.parse(req.body);
  const order = d.order ?? (await model.count());
  res.status(201).json(await model.create({ data: { ...d, order } }));
}));
admin.put('/:r/:id', h(async (req, res) => {
  const name = req.params.r;
  const { model, schema } = pick(name);
  const d: any = schema.partial().parse(req.body);
  if (name === 'sections') delete d.key; // key is fixed after creation
  res.json(await model.update({ where: { id: num(req.params.id) }, data: d }));
}));
admin.delete('/:r/:id', h(async (req, res) => {
  const name = req.params.r;
  const { model } = pick(name);
  const id = num(req.params.id);
  if (name === 'sections') {
    const row = await model.findUnique({ where: { id } });
    if (row && BUILTIN.includes(row.key)) throw new HttpError(400, 'Built-in sections can be hidden but not deleted');
  }
  await model.delete({ where: { id } });
  res.json({ ok: true });
}));