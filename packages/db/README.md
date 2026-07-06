# @greenfield/db

SQL migrations and Supabase artefacts for Greenfield Coffee.

## Layout

```
migrations/       Numbered SQL files, applied in lexical order
seed/             Optional seed data for local dev
src/              Generated TypeScript types (created by `pnpm generate`)
```

## Workflow

1. New schema change → add a new file `migrations/000N_description.sql`. Never edit a previously applied migration.
2. Read your migration before applying it. Paste into the Supabase dashboard SQL Editor, or use `supabase db push` if you have the CLI installed.
3. After the migration is applied, regenerate TypeScript types so `@greenfield/types` stays accurate:
   ```bash
   pnpm --filter @greenfield/db generate
   ```

## RLS reminder

Every multi-tenant table in this schema has row-level security enabled and policies keyed on `current_tenant_id()`, which reads the active tenant from the JWT claim `app_metadata->>tenant_id`. Auth flows must set this claim on sign-in. The migration in `0001_initial_schema.sql` defines the helper function.

## Local Supabase (optional)

If you want to run a local Postgres instead of your hosted one:

```bash
supabase init
supabase start
supabase db reset   # applies all migrations in order
```

This is great for testing migrations before you touch the hosted database.