import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { SavedPost } from "@/lib/types/models";

type DB = SupabaseClient<Database>;

// Inner joins so saves whose post is no longer visible (deleted account,
// unfriended) drop out instead of coming back as shells.
const SAVES_SELECT = `
  *,
  post:posts!inner(
    id, body, created_at,
    author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
    content_item:content_items!inner(*)
  )
`;

/** Bookmark a post. Idempotent: re-saving an already-saved post is a no-op. */
export async function savePost(
  db: DB,
  args: { postId: string; userId: string }
) {
  const { error } = await db
    .from("saves")
    .insert({ post_id: args.postId, user_id: args.userId });
  if (error && error.code !== "23505") throw error;
}

export async function unsavePost(
  db: DB,
  args: { postId: string; userId: string }
) {
  const { error } = await db
    .from("saves")
    .delete()
    .eq("post_id", args.postId)
    .eq("user_id", args.userId);
  if (error) throw error;
}

/** All of the user's saves, newest first, with the recommending post embedded. */
export async function listSaves(db: DB, userId: string): Promise<SavedPost[]> {
  const { data, error } = await db
    .from("saves")
    .select(SAVES_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SavedPost[];
}
