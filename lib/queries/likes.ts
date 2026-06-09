import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type DB = SupabaseClient<Database>;

export async function likePost(db: DB, postId: string, userId: string) {
  const { error } = await db
    .from("likes")
    .insert({ post_id: postId, user_id: userId });
  // 23505 = already liked (double-tap race); treat as success.
  if (error && error.code !== "23505") throw error;
}

export async function unlikePost(db: DB, postId: string, userId: string) {
  const { error } = await db
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}
