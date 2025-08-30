# rippl

## Supabase DB (TL;DR)

- DATABASE_URL: use Supabase PgBouncer (port 6543) for runtime.
- DIRECT_URL: use direct Postgres (port 5432) for migrations/seed.
- Prisma reads `DATABASE_URL` at runtime and `DIRECT_URL` for `migrate`.

Quick setup
- Copy `backend/.env.example` → `backend/.env` and fill project ref + password.
- Run: `cd backend && npm i && npm run db:migrate && npm run db:seed && npm run dev`.

