/**
 * End-to-end verification of the save feature against the local stack,
 * exercising the real query functions (same PostgREST embeds + RLS the app
 * uses). Run: npx tsx --env-file=.env.local scripts/verify-saves.ts
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database";
import { getFeed, getPost } from "../lib/queries/posts";
import { listSaves, savePost, unsavePost } from "../lib/queries/saves";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "ok" : "NOT OK"} - ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
}

async function signIn(email: string) {
  const db = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { db, userId: data.user!.id };
}

async function main() {
  const alice = await signIn("alice@example.com");
  const bob = await signIn("bob@example.com");

  // Alice's feed includes bob's posts with the saves embed present.
  const feed = await getFeed(alice.db, alice.userId);
  check("feed loads with saves embed", feed.posts.every((p) => Array.isArray(p.saves)));
  const bobPost = feed.posts.find((p) => p.author_id === bob.userId);
  if (!bobPost) throw new Error("no post by bob in alice's feed — reseed needed");
  check("unsaved post has empty saves array", bobPost.saves.length === 0);

  // Alice saves bob's post; it's idempotent.
  await savePost(alice.db, { postId: bobPost.id, userId: alice.userId });
  await savePost(alice.db, { postId: bobPost.id, userId: alice.userId });
  const feed2 = await getFeed(alice.db, alice.userId);
  const saved = feed2.posts.find((p) => p.id === bobPost.id)!;
  check("after saving, feed embeds the viewer's save row", saved.saves.length === 1);

  // Post detail carries the flag too.
  const detail = await getPost(alice.db, bobPost.id);
  check("post detail embeds the save row", detail !== null && detail.saves.length === 1);

  // The saved list embeds the recommending post + author + content item.
  const saves = await listSaves(alice.db, alice.userId);
  check("listSaves returns the save", saves.length === 1);
  const s = saves[0];
  check("save embeds post body", typeof s.post.body === "string" && s.post.body.length > 0);
  check("save embeds author", s.post.author.username === "bob");
  check(
    "save embeds typed content item",
    typeof s.post.content_item.title === "string" && typeof s.post.content_item.type === "string",
    `${s.post.content_item.type}: ${s.post.content_item.title}`
  );

  // Bob (the author) cannot see alice's save on his own post.
  const bobView = await getPost(bob.db, bobPost.id);
  check("post author cannot see other people's saves", bobView !== null && bobView.saves.length === 0);
  const bobSaves = await listSaves(bob.db, bob.userId);
  check("bob's own saved list is empty", bobSaves.length === 0);

  // Unsave clears everything.
  await unsavePost(alice.db, { postId: bobPost.id, userId: alice.userId });
  const after = await listSaves(alice.db, alice.userId);
  check("unsave removes the entry", after.length === 0);

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verification error:", e.message);
  process.exit(1);
});
