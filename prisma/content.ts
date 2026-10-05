import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// wake Neon before writing
async function wake() {
  for (let i = 1; i <= 6; i++) {
    try { await prisma.$queryRaw`SELECT 1`; return; }
    catch { console.log(`Waiting for database (${i}/6)…`); await sleep(3000); }
  }
  throw new Error('Database unreachable. Check DATABASE_URL in .env');
}

// photo, github, linkedin and resume are NOT touched, so your existing values stay
const profile = {
  name: 'MD. Ashraful Islam',
  title: 'Full Stack Developer',
  roles: ['Full Stack Developer', 'Next.js Developer', 'MERN Stack Developer'],
  tagline: 'I build scalable, production-ready web apps with Next.js, TypeScript, Node.js and PostgreSQL.',
  bio: [
    'I am a Full Stack Developer from Dhaka with hands-on experience building modern web applications. I hold a BSc in Computer Science and Engineering from American International University-Bangladesh (2022–2026).',
    'I completed a Full Stack Developer internship at IGL Web Ltd., where I contributed to RamBD, a production e-commerce platform for gadgets and electronics built with Next.js 15, React 18 and TypeScript.',
    'I care about clean code, solving complex problems and continuously learning new technologies to build efficient, user-friendly applications. I also co-authored a research paper on requirement defects in software engineering.',
  ].join('\n'),
  email: 'imroser65@gmail.com',
  phone: '+8801707660052',
  whatsapp: 'https://wa.me/8801707660052',
  location: 'Dhaka, Bangladesh',
  status: 'Open to work',
};

const stats = [
  { label: 'Projects built', value: 3 },
  { label: 'Internship months', value: 3 },
  { label: 'Paper published', value: 1 },
  { label: 'Technologies', value: 15 },
];

// source "github" = percentage is calculated from your GitHub repos (the number here is the fallback)
const skills = [
  { group: 'Frontend', name: 'JavaScript', level: 90, source: 'github' },
  { group: 'Frontend', name: 'TypeScript', level: 80, source: 'github' },
  { group: 'Frontend', name: 'React', level: 90, source: 'github' },
  { group: 'Frontend', name: 'Next.js', level: 88, source: 'github' },
  { group: 'Frontend', name: 'Tailwind CSS', level: 90, source: 'github' },
  { group: 'Frontend', name: 'React Router', level: 85, source: 'manual' },
  { group: 'Backend & Database', name: 'Node.js', level: 85, source: 'github' },
  { group: 'Backend & Database', name: 'Express', level: 85, source: 'github' },
  { group: 'Backend & Database', name: 'MongoDB', level: 80, source: 'github' },
  { group: 'Backend & Database', name: 'PostgreSQL', level: 78, source: 'github' },
  { group: 'Backend & Database', name: 'Prisma', level: 78, source: 'github' },
  { group: 'Auth & Payments', name: 'Firebase', level: 80, source: 'github' },
  { group: 'Auth & Payments', name: 'JWT', level: 85, source: 'manual' },
  { group: 'Auth & Payments', name: 'Stripe', level: 80, source: 'manual' },
  { group: 'Tools & Deployment', name: 'Git', level: 90, source: 'manual' },
  { group: 'Tools & Deployment', name: 'GitHub', level: 90, source: 'manual', icon: 'github' },
  { group: 'Tools & Deployment', name: 'Postman', level: 85, source: 'manual' },
  { group: 'Tools & Deployment', name: 'Vercel', level: 85, source: 'manual' },
  { group: 'Tools & Deployment', name: 'Netlify', level: 80, source: 'manual' },
  { group: 'Tools & Deployment', name: 'Vite', level: 80, source: 'manual', icon: 'vitejs' },
];

// live / repo links are left empty: add them from Admin > Projects
const projects = [
  {
    title: 'RentNest — Rental Property Marketplace', category: 'Full-Stack', year: '', featured: true,
    description: 'Full-stack rental marketplace with three role-based dashboards (Tenant, Landlord, Admin). JWT authentication with two-layer route protection (middleware and client-side role guards), end-to-end Stripe payments, full CRUD for listings, rental requests and reviews, and optimistic UI for instant approve/reject actions.',
    tags: ['Next.js', 'TypeScript', 'TanStack Query', 'Tailwind CSS', 'Stripe', 'Express', 'Prisma', 'PostgreSQL'],
  },
  {
    title: 'RamBD — E-Commerce Web Application', category: 'E-Commerce', year: '', featured: true,
    description: 'Production e-commerce platform for gadgets and electronics serving customers across Bangladesh. Phone-based OTP authentication, shopping cart, dynamic checkout with shipping cost, product reviews, PDF invoices and order confirmation pages. Deployed on cPanel using PM2.',
    tags: ['Next.js 15', 'React 18', 'TypeScript', 'REST API'],
  },
  {
    title: 'TicketBari — Online Ticket Booking Platform', category: 'Full-Stack', year: '', featured: false,
    description: 'MERN application for online ticket booking with role-based access (User, Vendor, Admin), JWT authentication, protected dashboards and Stripe payments. Ticket search, transport-type filtering, price sorting and booking management with a responsive Tailwind CSS UI.',
    tags: ['React', 'Tailwind CSS', 'Node.js', 'Express.js', 'MongoDB', 'JWT', 'Stripe'],
  },
];

const experience = [
  {
    role: 'Full Stack Developer Intern', org: 'IGL Web Ltd. — Dhaka, Bangladesh', period: '12 Jan 2026 — 16 Mar 2026',
    points: [
      'Built RamBD, a full-featured e-commerce platform for gadgets and electronics using Next.js 15, React 18 and TypeScript.',
      'Implemented OTP authentication, shopping cart, dynamic checkout with shipping cost, product reviews and PDF invoice generation.',
      'Integrated REST APIs, optimized SEO with dynamic metadata and sitemap, and deployed on cPanel using PM2.',
    ],
  },
  {
    role: 'BSc in Computer Science and Engineering', org: 'American International University-Bangladesh', period: '2022 — 2026',
    points: ['Co-authored a peer-reviewed research paper on requirement defects (IJMSC, 2026).'],
  },
  {
    role: 'Hackathon Participant', org: 'SOLVIO AI Hackathon 2025', period: '2025',
    points: ['Qualified for Round 2.'],
  },
];

const posts = [
  {
    title: 'Comparative Study of Functional vs. Non-Functional Requirement Defects in Practice',
    date: '2026',
    summary: 'Published in the International Journal of Mathematical Sciences and Computing (IJMSC), Vol. 12, No. 2, pp. 51–65. Co-authored with S. M. Ahsan Habib, Md. Shariful Islam, Jannatul Hoque Samy and Jubayer Ahamed.',
    link: 'https://doi.org/10.5815/ijmsc.2026.02.04',
  },
];

async function main() {
  await wake();
  await prisma.profile.upsert({ where: { id: 1 }, update: profile, create: { id: 1, ...profile } });

  // these lists are REPLACED, so run this script once on fresh/sample data
  await prisma.$transaction([
    prisma.stat.deleteMany(), prisma.stat.createMany({ data: stats.map((x, order) => ({ ...x, order })) }),
    prisma.skill.deleteMany(), prisma.skill.createMany({ data: skills.map((x, order) => ({ ...x, order })) }),
    prisma.project.deleteMany(), prisma.project.createMany({ data: projects.map((x, order) => ({ ...x, order })) }),
    prisma.experience.deleteMany(), prisma.experience.createMany({ data: experience.map((x, order) => ({ ...x, order })) }),
    prisma.post.deleteMany(), prisma.post.createMany({ data: posts.map((x, order) => ({ ...x, order })) }),
    prisma.section.updateMany({ where: { key: 'blogs' }, data: { title: 'Publications', subtitle: 'Research & writing' } }),
  ]);
  console.log('Content imported from resume. Refresh your site.');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());