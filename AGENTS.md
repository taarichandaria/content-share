<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Forum (content-share)

Friends-only content sharing: posts with commentary about content items
(articles/podcasts/videos/books/anything), margin-note comments, ongoing
book reads with progress posts. See README.md for setup and architecture.
(A `likes` table exists in the schema but the like feature was removed from
the app; the posts->profiles FK ambiguity below comes from it.)

## Rules

- RLS is the authorization layer. Any new table needs policies in a migration AND
  pgTAP coverage in `supabase/tests/` (`npm run test:db` must pass).
- Schema changes: new file in `supabase/migrations/` (never edit applied ones),
  `supabase db reset`, then `npm run db:types` to regenerate `lib/types/database.ts`.
- All data access lives in `lib/queries/*.ts` as functions taking a
  `SupabaseClient` — keeps the data layer portable to a future React Native app.
  No inline queries in components.
- Friendships: one canonical row per pair (`user_a < user_b`). Always use
  `canonicalPair()` from `lib/queries/friends.ts`.
- PostgREST embeds of `posts -> profiles` must name the FK
  (`profiles!posts_author_id_fkey`) — two relationship paths exist (author, likes).
- Next 16: root request handler is `proxy.ts` (not `middleware.ts`).
- Dev server, Supabase local stack (Docker via colima), and seed users
  (alice/bob/carol @ password123) — see README commands.

## Learnings

- Don't pipe long-running dev servers through `head`/`tail` — when the pipe
  closes, the server blocks on stdout and wedges. Redirect to a file instead.
- `supabase start` fails on colima with the analytics (vector) container's
  docker.sock mount — keep `[analytics] enabled = false` in `supabase/config.toml`.
- `npm run db:types` truncates `lib/types/database.ts` via shell redirect even
  when generation fails (the CLI's helper containers are OOM-prone on this 6GB
  colima VM). Generate to a temp file and copy on success, or `git checkout`
  the file after a failure.
- If the CLI's container-based `test db` is unusable, pgTAP tests run fine via
  psql in a throwaway `supabase/postgres` container — but the bare image ships
  the legacy `auth.uid()` (reads `request.jwt.claim.sub`); redefine it as
  `supabase_admin` to also read `request.jwt.claims`, and expect the storage.*
  statements in migrations to fail (no storage-api service).
- Never `docker restart` a single supabase container (e.g. auth) — Kong caches
  upstream DNS and starts returning 502s. Restart the whole stack instead; on
  colima the health checks are flaky, so retry with
  `supabase start --ignore-health-check` (storage/pg_meta aren't needed).
- After `supabase db reset` + re-seed, browser sessions still hold tokens for
  deleted user ids: proxy-refreshed pages render fine but API route handlers
  401. Sign out/in (or clear cookies) before debugging "broken" API auth.
