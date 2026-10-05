// Pulls stats from GitHub (public API). The result is saved in the database, so every server instance (including Vercel) shares it.
import { prisma } from './prisma';

const TOKEN = process.env.GITHUB_TOKEN;
const TTL = 6 * 60 * 60 * 1000; // after 6 hours the data is refreshed in the background (best effort)
const CACHE_KEY = '_github_cache';

// technologies we can detect from package.json dependencies (languages come from GitHub itself)
const DEPS: Record<string, string[]> = {
  'React': ['react'], 'Next.js': ['next'], 'Vue': ['vue'], 'Nuxt': ['nuxt'], 'Angular': ['@angular/core'], 'Svelte': ['svelte'],
  'Express': ['express'], 'NestJS': ['@nestjs/core'], 'Prisma': ['prisma', '@prisma/client'], 'Tailwind CSS': ['tailwindcss'],
  'TypeScript': ['typescript'], 'Redux': ['redux', '@reduxjs/toolkit'], 'MongoDB': ['mongodb', 'mongoose'],
  'PostgreSQL': ['pg', 'postgres', '@neondatabase/serverless'], 'MySQL': ['mysql', 'mysql2'], 'Redis': ['redis', 'ioredis'],
  'Firebase': ['firebase'], 'GraphQL': ['graphql'], 'Socket.io': ['socket.io', 'socket.io-client'], 'Sass': ['sass'],
};

export type Day = { date: string; count: number; level: number };
export type GitHubData = {
  username: string; name: string; avatar: string; url: string; bio: string; since: number;
  followers: number; following: number; repos: number; stars: number; contributions: number;
  streak: { current: number; longest: number };
  calendar: Day[];
  languages: { name: string; percent: number }[];
  topRepos: { name: string; description: string; stars: number; language: string; url: string }[];
  techUsage: Record<string, number>; // % of analysed repos that use each technology
  fetchedAt: string;
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
export const usageMap = (g: GitHubData | null) => new Map(Object.entries(g?.techUsage ?? {}).map(([k, v]) => [norm(k), v]));

const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'portfolio-api', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
async function gh<T = any>(path: string): Promise<T> {
  const r = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`GitHub API ${r.status} for ${path}${r.status === 403 ? ' (rate limit: add GITHUB_TOKEN)' : ''}`);
  return (await r.json()) as T;
}
async function mapLimit<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const x = items[i++]; await fn(x); } }));
}

// contribution calendar. GitHub has no REST endpoint for it, so a public helper API is used.
// year = "last" (rolling 12 months) or a 4-digit year
export async function fetchCalendar(username: string, year: string): Promise<Day[]> {
  try {
    const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=${year}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const j: any = await r.json();
    return (j.contributions || []).map((c: any) => ({ date: String(c.date), count: Number(c.count) || 0, level: Number(c.level) || 0 }));
  } catch { return []; }
}

async function build(username: string): Promise<GitHubData> {
  const u = encodeURIComponent(username);
  const [user, repos] = await Promise.all([gh<any>(`/users/${u}`), gh<any[]>(`/users/${u}/repos?per_page=100&sort=pushed&type=owner`)]);
  const own = repos.filter((r) => !r.fork);
  const sample = own.slice(0, 25); // most recently pushed repos
  const bytes: Record<string, number> = {};
  const used: Record<string, number> = {};

  await mapLimit(sample, 5, async (r) => {
    const techs = new Set<string>();
    const langs = await gh<Record<string, number>>(`/repos/${r.full_name}/languages`).catch(() => ({} as Record<string, number>));
    for (const [l, b] of Object.entries(langs)) { bytes[l] = (bytes[l] || 0) + b; techs.add(l); }

    const deps = new Set<string>();
    let hasPkg = false;
    await Promise.all(['', 'frontend/', 'backend/', 'client/', 'server/'].map(async (dir) => {
      try {
        const x = await fetch(`https://raw.githubusercontent.com/${r.full_name}/${r.default_branch}/${dir}package.json`, { signal: AbortSignal.timeout(8000) });
        if (!x.ok) return;
        hasPkg = true;
        const j: any = await x.json();
        Object.keys({ ...j.dependencies, ...j.devDependencies }).forEach((k) => deps.add(k));
      } catch { /* ignore missing files */ }
    }));
    if (hasPkg) techs.add('Node.js');
    for (const [tech, names] of Object.entries(DEPS)) if (names.some((n) => deps.has(n))) techs.add(tech);
    techs.forEach((t) => { used[t] = (used[t] || 0) + 1; });
  });

  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, b]) => ({ name, percent: Math.round((b / total) * 1000) / 10 }));
  const techUsage = Object.fromEntries(Object.entries(used).map(([k, v]) => [k, Math.round((v / Math.max(1, sample.length)) * 100)]));

  const calendar = await fetchCalendar(username, 'last');
  let longest = 0, run = 0;
  for (const d of calendar) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0;
  for (let i = calendar.length - 1; i >= 0; i--) {
    if (calendar[i].count > 0) current++;
    else if (i === calendar.length - 1) continue; // today may not have commits yet
    else break;
  }

  return {
    username: user.login, name: user.name || '', avatar: user.avatar_url, url: user.html_url, bio: user.bio || '',
    since: new Date(user.created_at).getFullYear(),
    followers: user.followers, following: user.following, repos: user.public_repos,
    stars: own.reduce((a, r) => a + r.stargazers_count, 0),
    contributions: calendar.reduce((a, d) => a + d.count, 0),
    streak: { current, longest }, calendar, languages, techUsage,
    topRepos: [...own].sort((a, b) => b.stargazers_count - a.stargazers_count || +new Date(b.pushed_at) - +new Date(a.pushed_at)).slice(0, 6)
      .map((r) => ({ name: r.name, description: r.description || '', stars: r.stargazers_count, language: r.language || '', url: r.html_url })),
    fetchedAt: new Date().toISOString(),
  };
}

// ---------- cache: memory + database ----------
type Cached = { at: number; username: string; data: GitHubData };
let mem: Cached | null = null;
let inflight: Promise<GitHubData | null> | null = null;
let failedAt = 0;

async function load(name: string): Promise<Cached | null> {
  if (mem && mem.username.toLowerCase() === name.toLowerCase()) return mem;
  const row = await prisma.setting.findUnique({ where: { key: CACHE_KEY } }).catch(() => null);
  const c = row?.value as unknown as Cached | undefined;
  if (c && c.username?.toLowerCase() === name.toLowerCase()) { mem = c; return c; }
  return null;
}

function refresh(name: string): Promise<GitHubData | null> {
  if (!inflight) {
    inflight = build(name)
      .then(async (data) => {
        const c: Cached = { at: Date.now(), username: name, data };
        mem = c;
        await prisma.setting
          .upsert({ where: { key: CACHE_KEY }, update: { value: c as any }, create: { key: CACHE_KEY, value: c as any } })
          .catch((e) => console.error('GitHub cache save failed:', e.message));
        return data;
      })
      .catch((e) => { failedAt = Date.now(); console.error('GitHub sync failed:', e.message); return null; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export async function getGithub(username: string, force = false): Promise<GitHubData | null> {
  const name = (username || '').trim();
  if (!name) return null;
  if (force) return refresh(name);
  const c = await load(name);
  if (c) {
    if (Date.now() - c.at > TTL && Date.now() - failedAt > 60_000) void refresh(name); // stale: refresh in background
    return c.data;
  }
  if (Date.now() - failedAt < 60_000) return null; // back off after a failure
  return refresh(name);
}

// calendar for a single year (used by the year buttons on the site)
const calCache = new Map<string, { at: number; days: Day[] }>();
export async function getCalendar(username: string, year: string): Promise<Day[] | null> {
  const key = `${username.toLowerCase()}:${year}`;
  const hit = calCache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.days;
  const days = await fetchCalendar(username, year);
  if (!days.length) return hit?.days ?? null;
  calCache.set(key, { at: Date.now(), days });
  return days;
}