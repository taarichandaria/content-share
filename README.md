# Forum

A friends-only content-sharing app — a shared record of everything you and
your friends are reading, watching, and listening to. Share articles, podcasts,
videos, tweets, books, films, recipes, or anything else with your own commentary;
friends leave "margin notes" (comments). Books are ongoing reads: start
one, post progress updates as you go, then mark it finished.

Built with Next.js (App Router) + Supabase. The feed only ever shows posts from
accepted friends — enforced by Postgres row-level security, not just the UI.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4) — note Next 16 uses `proxy.ts`
  instead of `middleware.ts`
- **Supabase** — Postgres, Auth (email/password + Google), Storage (avatars)
- All CRUD goes straight from the client to Supabase under RLS (mobile-ready: a
  future React Native app reuses the same backend). The only custom endpoint is
  `POST /api/unfurl`, which fetches Open Graph metadata server-side.

## Local development

Prereqs: Node 20+, Docker runtime (colima works: `colima start`), Supabase CLI.

```bash
npm install
supabase start                  # local Postgres/Auth/Storage stack
cp .env.example .env.local      # fill in keys printed by `supabase start`
npm run seed                    # test users: alice / bob / carol @ password123
npm run dev
```

Seeded state: alice ↔ bob are friends; alice → carol request pending; alice is
reading The Power Broker with progress posts.

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | dev server at localhost:3000 |
| `npm run seed` | reset + reseed test users and sample data |
| `npm run test:unit` | vitest (unfurl parsing) |
| `npm run test:db` | pgTAP tests for RLS + friendship state machine |
| `npm run db:types` | regenerate `lib/types/database.ts` after schema changes |
| `supabase db reset` | re-apply all migrations from scratch |

## Architecture notes

- `supabase/migrations/` — schema (`…0001_init.sql`) and RLS policies
  (`…0002_rls.sql`). Never edit schema in the Studio UI; add a migration.
- `lib/queries/*.ts` — all data access, as functions taking a `SupabaseClient`.
  No query logic in components.
- **Friendships** are one canonical row per pair (`user_a < user_b`, enforced by a
  check constraint). Always go through `canonicalPair()` in `lib/queries/friends.ts`.
- **Content items are owned per-post** (not deduplicated by URL) so each sharer
  controls their own card metadata and RLS stays simple.
- **Book progress posts** are normal posts with `read_id` set; `content_item_id`
  is denormalized onto every post so the feed is a single uniform query (a DB
  trigger keeps it consistent with the read).
- Visibility: a post/read/content item is visible to its owner and accepted
  friends only (`are_friends()` security-definer function). Comments piggyback
  on post visibility via an invoker-rights `EXISTS` subquery. (A `likes` table
  exists in the schema with the same pattern but is currently unused by the UI.)

## Deploying

1. Create a hosted Supabase project; `supabase link --project-ref <ref>` then
   `supabase db push` to apply migrations (this also provisions the `avatars`
   storage bucket and its policies — no manual setup).
2. Google sign-in: create an OAuth client in Google Cloud Console with
   `https://<ref>.supabase.co/auth/v1/callback` as the authorized redirect URI,
   paste its client ID/secret into Supabase Auth → Providers → Google, then under
   Auth → URL Configuration set the Site URL and add
   `https://<your-domain>/auth/callback` to the redirect allow-list.
3. Deploy to Vercel with the app's runtime env vars: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (optional) `ANTHROPIC_API_KEY` for link
   enrichment. `SUPABASE_SERVICE_ROLE_KEY` is seed-script-only — keep it out of
   prod.
