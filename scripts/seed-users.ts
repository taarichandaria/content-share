/**
 * Seeds local dev data: three users (alice, bob, carol — password
 * "password123"), a friendship graph, sample posts, comments, and an
 * in-progress book read with progress posts.
 *
 * Run: npm run seed   (requires `supabase start` to be running)
 *
 * Idempotent: deletes and recreates the seed users (cascades wipe their data).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run via `npm run seed` so .env.local is loaded)"
  );
  process.exit(1);
}

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: "alice@example.com", username: "alice", display_name: "Alice Chen" },
  { email: "bob@example.com", username: "bob", display_name: "Bob Okafor" },
  { email: "carol@example.com", username: "carol", display_name: "Carol Reyes" },
] as const;

async function main() {
  // Recreate users from scratch so the script is re-runnable.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of existing?.users ?? []) {
    if (USERS.some((s) => s.email === u.email)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: "password123",
      email_confirm: true,
      user_metadata: { username: u.username, display_name: u.display_name },
    });
    if (error) throw error;
    ids[u.username] = data.user.id;
    console.log(`created ${u.username} (${data.user.id})`);
  }

  const [alice, bob, carol] = [ids.alice, ids.bob, ids.carol];
  const pair = (x: string, y: string) =>
    x < y ? { user_a: x, user_b: y } : { user_a: y, user_b: x };

  // alice <-> bob friends; alice -> carol pending
  {
    const { error } = await admin.from("friendships").insert([
      { ...pair(alice, bob), requester_id: alice, status: "accepted" },
      { ...pair(alice, carol), requester_id: alice, status: "pending" },
    ]);
    if (error) throw error;
  }

  async function share(
    authorId: string,
    item: Database["public"]["Tables"]["content_items"]["Insert"],
    body: string
  ) {
    const { data: ci, error: e1 } = await admin
      .from("content_items")
      .insert({ ...item, created_by: authorId })
      .select("id")
      .single();
    if (e1) throw e1;
    const { data: post, error: e2 } = await admin
      .from("posts")
      .insert({ author_id: authorId, content_item_id: ci.id, body })
      .select("id")
      .single();
    if (e2) throw e2;
    return post.id;
  }

  const alicePost = await share(
    alice,
    {
      type: "article",
      url: "https://www.newyorker.com/magazine/2024/01/01/example",
      title: "The Quiet Profundity of Everyday Routines",
      description: "On the rituals that structure a life.",
      site_name: "The New Yorker",
      created_by: alice,
    },
    "This completely changed how I think about my mornings. The bit about attention as a finite resource is worth the whole read."
  );

  await share(
    bob,
    {
      type: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "The Art of Code — Dylan Beattie",
      description: "Software as a creative medium.",
      site_name: "YouTube",
      created_by: bob,
    },
    "Funniest and smartest conference talk I've seen in years. The Rockstar language section killed me."
  );

  await share(
    bob,
    {
      type: "podcast",
      url: "https://open.spotify.com/episode/example",
      title: "Acquired: The Costco Episode",
      description: "How Costco built a cult.",
      site_name: "Spotify",
      created_by: bob,
    },
    "Three hours about a warehouse club and I was riveted the entire time."
  );

  // carol posts too — invisible to alice/bob until her request is accepted.
  await share(
    carol,
    {
      type: "blog",
      url: "https://example.substack.com/p/slow-productivity",
      title: "Slow Productivity Notes",
      site_name: "Substack",
      created_by: carol,
    },
    "Short but sharp — the 'do fewer things' section is the whole argument."
  );

  // Comments on alice's post
  {
    const { error } = await admin.from("comments").insert([
      { post_id: alicePost, author_id: bob, body: "Adding this to my list — your take on attention sold me." },
      { post_id: alicePost, author_id: alice, body: "Report back when you read it!" },
    ]);
    if (error) throw error;
  }

  // alice is reading a book with two progress posts
  const { data: bookItem, error: bookErr } = await admin
    .from("content_items")
    .insert({
      created_by: alice,
      type: "book",
      title: "The Power Broker",
      creator: "Robert Caro",
      description: "Robert Moses and the fall of New York.",
    })
    .select("id")
    .single();
  if (bookErr) throw bookErr;

  const { data: read, error: readErr } = await admin
    .from("reads")
    .insert({ user_id: alice, content_item_id: bookItem.id })
    .select("id")
    .single();
  if (readErr) throw readErr;

  const { error: progErr } = await admin.from("posts").insert([
    {
      author_id: alice,
      content_item_id: bookItem.id,
      read_id: read.id,
      body: "Finally starting this monster. 1,300 pages, wish me luck.",
      progress: "p. 1",
    },
    {
      author_id: alice,
      content_item_id: bookItem.id,
      read_id: read.id,
      body: "The chapter on how he took over the parks commission is jaw-dropping. Power through paperwork.",
      progress: "p. 220",
    },
  ]);
  if (progErr) throw progErr;

  console.log("Seed complete: alice/bob/carol @ password123");
  console.log("alice<->bob friends; alice->carol pending; alice reading The Power Broker");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
