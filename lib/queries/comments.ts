import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { CommentWithAuthor } from "@/lib/types/models";

type DB = SupabaseClient<Database>;

export async function addComment(
  db: DB,
  args: { postId: string; authorId: string; body: string }
): Promise<CommentWithAuthor> {
  const { data, error } = await db
    .from("comments")
    .insert({
      post_id: args.postId,
      author_id: args.authorId,
      body: args.body,
    })
    .select("*, author:profiles(id, username, display_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as unknown as CommentWithAuthor;
}

export async function deleteComment(db: DB, id: string) {
  const { error } = await db.from("comments").delete().eq("id", id);
  if (error) throw error;
}
