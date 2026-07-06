# Greenfield Coffee

Operations toolkit for UK and EU small-to-medium coffee roasteries. Traceability and EU Deforestation Regulation (EUDR) compliance are structural, not features.

## Status

**Phase 0 — fresh scaffold.** One tenant, one origin, one EU shipment, end-to-end chain working. See `Plans/index.html` for the design reference.

## Repository layout

```
greenfield-coffee/
├── apps/
│   └── web/                  Next.js 16 application (App Router, Tailwind 4)
├── packages/
│   ├── db/                   SQL migrations + generated TypeScript types
│   ├── ui/                   Shared React components and design tokens
│   └── types/                Shared TypeScript shapes (lots, batches, orders, DDS)
└── Plans/                    Design reference (wireframe clickthrough)
```

## Tech stack

| Layer            | Choice                                | Version  |
|------------------|---------------------------------------|----------|
| App framework    | Next.js (App Router, Turbopack)       | 16.2.10  |
| UI runtime       | React                                 | 19.2.7   |
| Language         | TypeScript                            | 6.0.3    |
| Styling          | Tailwind CSS (CSS-first config)       | 4.3.2    |
| Database         | Supabase Postgres (London / eu-west-2)| hosted   |
| Auth + Storage   | Supabase                              | hosted   |
| Client           | @supabase/supabase-js + @supabase/ssr | 2.110/0.12 |
| Forms            | react-hook-form + zod                 | 7.81 / 4.4 |
| PDF              | @react-pdf/renderer                   | 4.5.1    |
| E2E tests        | Playwright                            | 1.61.1   |
| Package manager  | pnpm workspaces                       | 9.x      |

## Local development

Prerequisites: Node.js 20.10 or newer, pnpm 9.x.

```bash
pnpm install
cp .env.example apps/web/.env.local  # fill in from your Supabase dashboard
pnpm --filter @greenfield/web dev    # starts apps/web on http://localhost:3000
```

> **Why `apps/web/.env.local` and not the repo root?** Next.js loads `.env.local` relative to the directory it's serving from. `pnpm --filter @greenfield/web dev` runs Next from `apps/web/`, so that's where the env file needs to live. `apps/web/` is git-ignored.

### Getting your Supabase keys

In the Supabase dashboard, sign in and select your project. The keys live in:

- **Project URL** and **publishable / anon key** — Settings → API Keys (look for the URL field at the top and the `sb_publishable_xxx` or `anon public` row in the keys table)
- **Service role / secret key** — same page, in the `sb_secret_xxx` or `service_role secret` row

Supabase rolled out new publishable/secret keys in 2026 to replace the legacy JWT-based anon/service_role keys. Both work today; the legacy keys will be deprecated by end of 2026. Either name works in the env vars below — paste whatever your dashboard gives you.

The `.env.local` keys you'll set:

```
NEXT_PUBLIC_SUPABASE_URL=https://rcxpxoofhelkpvdunhwq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx...   (or the legacy anon JWT)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx...             (or the legacy service_role JWT)
```

## Database setup

The SQL migration in `packages/db/migrations/0001_initial_schema.sql` creates the schema, row-level security policies, and the audit log. **You review and apply it yourself** — never let an agent push to your database blind.

Recommended workflow:

1. Open `packages/db/migrations/0001_initial_schema.sql`, read it through.
2. In the Supabase dashboard, go to SQL Editor, paste the contents, run.
3. After it's applied, regenerate types: `pnpm --filter @greenfield/db generate`.
4. Re-run `pnpm typecheck` to confirm the generated types match `packages/types`.

## Roles

- **owner** — full access, billing, user invites
- **roaster** — daily board, receive green, schedule/complete roasts
- **sales** — orders, customers, allocations
- **auditor** — read-only across everything including the audit log

## License

Proprietary. All rights reserved.