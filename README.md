# Backend: Node.js + Express + TypeScript + Prisma + PostgreSQL
cp .env.example .env      # set DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD
npm install
npm run db:push           # create tables
npm run db:seed           # admin user + starter content
npm run dev               # http://localhost:4000

Public:  GET /api/site, POST /api/contact
Auth:    POST /api/auth/login  -> { token }
Admin (Bearer token): /api/admin/{profile,settings,messages,summary}
         and generic CRUD + reorder for: sections, stats, skills, projects, experience, posts
Production: npm run build && npm start   (use `prisma migrate deploy` instead of db:push)
