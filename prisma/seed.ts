import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 8) throw new Error('Set ADMIN_PASSWORD (8+ chars) in .env');
  const passwordHash = await bcrypt.hash(pw, 12);
  await prisma.admin.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });

  await prisma.profile.upsert({
    where: { id: 1 }, update: {},
    create: {
      id: 1, name: 'Your Name', title: 'Full-Stack Developer',
      roles: ['Full-Stack Developer', 'UI Engineer', 'API Designer'],
      tagline: 'I build fast, polished web products from interface to database.',
      bio: 'Write your story from the admin panel.\nSecond paragraph: what you love building and how you work.',
      email: 'you@example.com', location: 'Dhaka, Bangladesh',
      github: 'https://github.com/', linkedin: 'https://linkedin.com/',
    },
  });

  if (!(await prisma.section.count()))
    await prisma.section.createMany({ data: [
      { key: 'about', title: 'About', subtitle: 'Who I am', order: 0 },
      { key: 'skills', title: 'Skills', subtitle: 'What I build with', order: 1 },
      { key: 'projects', title: 'Work', subtitle: 'Selected projects', order: 2 },
      { key: 'experience', title: 'Journey', subtitle: 'Experience & education', order: 3 },
      { key: 'blogs', title: 'Blog', subtitle: 'Notes & writing', order: 4 },
      { key: 'contact', title: 'Contact', subtitle: 'Say hello', order: 5 },
    ] });
  if (!(await prisma.stat.count()))
    await prisma.stat.createMany({ data: [
      { label: 'Projects shipped', value: 8, order: 0 }, { label: 'Technologies', value: 20, order: 1 }, { label: 'Years coding', value: 3, order: 2 },
    ] });
  if (!(await prisma.skill.count()))
    await prisma.skill.createMany({ data: [
      { group: 'Frontend', name: 'Next.js', level: 90, order: 0 }, { group: 'Frontend', name: 'TypeScript', level: 88, order: 1 },
      { group: 'Backend', name: 'Express', level: 88, order: 2 }, { group: 'Backend', name: 'Prisma', level: 85, order: 3 },
      { group: 'Database', name: 'PostgreSQL', level: 82, order: 4 },
    ] });
  if (!(await prisma.project.count()))
    await prisma.project.create({ data: {
      title: 'Sample Project', category: 'Full-Stack', year: '2026', featured: true,
      description: 'Add your own projects from the admin panel: image, tags, live link and source link.',
      tags: ['Next.js', 'Express', 'PostgreSQL'],
    } });
  if (!(await prisma.experience.count()))
    await prisma.experience.create({ data: {
      role: 'Full-Stack Developer', org: 'Personal Projects', period: '2024 — Present',
      points: ['Shipped complete products end to end.', 'Designed typed REST APIs with validation and auth.'],
    } });
  if (!(await prisma.post.count()))
    await prisma.post.create({ data: { title: 'My first post', date: '2026-01-01', summary: 'Edit or hide this from the admin panel.' } });
  console.log(`Seed done. Admin login: ${email}`);
}

main().finally(() => prisma.$disconnect());
