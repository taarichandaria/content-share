import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type {
  FeedPost,
  PostDetail,
  NewContentItem,
} from "@/lib/types/models";

type DB = SupabaseClient<Database>;

export const FEED_PAGE_SIZE = 20;

const FEED_SELECT = `
  *,
  content_item:content_items(*),
  author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
  read:reads(id, status),
  comments(count),
  saves(user_id)
`;

const DETAIL_SELECT = `
  *,
  content_item:content_items(*),
  author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url),
  read:reads(id, status),
  comments(*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)),
  saves(user_id)
`;

export interface FeedPage {
  posts: FeedPost[];
  /** Pass as `before` to fetch the next page; null when exhausted. */
  nextCursor: string | null;
}

/**
 * Friends-only feed. We filter by author_id explicitly (self + friends via
 * the friend_ids RPC) so the (author_id, created_at) index drives the plan;
 * RLS independently re-verifies every row.
 */
export async function getFeed(
  db: DB,
  userId: string,
  opts: { before?: string; authorId?: string } = {}
): Promise<FeedPage> {
  let authorIds: string[];
  if (opts.authorId) {
    authorIds = [opts.authorId];
  } else {
    const { data: ids, error } = await db.rpc("friend_ids", { u: userId });
    if (error) throw error;
    authorIds = [userId, ...(ids ?? [])];
  }

  let query = db
    .from("posts")
    .select(FEED_SELECT)
    .in("author_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE);
  if (opts.before) query = query.lt("created_at", opts.before);

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []) as unknown as FeedPost[];
  return {
    posts,
    nextCursor:
      posts.length === FEED_PAGE_SIZE
        ? posts[posts.length - 1].created_at
        : null,
  };
}

export async function getPost(db: DB, id: string): Promise<PostDetail | null> {
  const { data, error } = await db
    .from("posts")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .order("created_at", { referencedTable: "comments", ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PostDetail | null;
}

/** Share something new: creates the content item, then the post about it. */
export async function createPost(
  db: DB,
  args: { authorId: string; body: string; contentItem: NewContentItem }
): Promise<string> {
  const { data: item, error: itemError } = await db
    .from("content_items")
    .insert({ ...args.contentItem, created_by: args.authorId })
    .select("id")
    .single();
  if (itemError) throw itemError;

  const { data: post, error: postError } = await db
    .from("posts")
    .insert({
      author_id: args.authorId,
      content_item_id: item.id,
      body: args.body,
    })
    .select("id")
    .single();
  if (postError) {
    // Best-effort cleanup of the orphaned content item.
    await db.from("content_items").delete().eq("id", item.id);
    throw postError;
  }
  return post.id;
}

/** A reading update attached to an existing read. */
export async function createProgressPost(
  db: DB,
  args: {
    authorId: string;
    readId: string;
    contentItemId: string;
    body: string;
    progress: string | null;
  }
): Promise<string> {
  const { data, error } = await db
    .from("posts")
    .insert({
      author_id: args.authorId,
      content_item_id: args.contentItemId,
      read_id: args.readId,
      body: args.body,
      progress: args.progress,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deletePost(db: DB, id: string) {
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) throw error;
}
