import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { ReadWithItem, ReadStatus } from "@/lib/types/models";

type DB = SupabaseClient<Database>;

const READ_SELECT = `*, content_item:content_items(*)`;

export async function listReads(
  db: DB,
  userId: string,
  status?: ReadStatus
): Promise<ReadWithItem[]> {
  let query = db
    .from("reads")
    .select(READ_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as ReadWithItem[];
}

export interface NewBook {
  title: string;
  creator: string | null;
  url: string | null;
  image_url: string | null;
  description: string | null;
}

/**
 * Start reading a book: creates the book's content item and the read.
 * Returns ids so the caller can optionally compose a first progress post.
 */
export async function startRead(
  db: DB,
  args: { userId: string; book: NewBook }
): Promise<{ readId: string; contentItemId: string }> {
  const { data: item, error: itemError } = await db
    .from("content_items")
    .insert({
      created_by: args.userId,
      type: "book",
      title: args.book.title,
      creator: args.book.creator,
      url: args.book.url,
      image_url: args.book.image_url,
      description: args.book.description,
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  const { data: read, error: readError } = await db
    .from("reads")
    .insert({ user_id: args.userId, content_item_id: item.id })
    .select("id")
    .single();
  if (readError) {
    await db.from("content_items").delete().eq("id", item.id);
    throw readError;
  }
  return { readId: read.id, contentItemId: item.id };
}

export async function setReadStatus(
  db: DB,
  readId: string,
  status: Exclude<ReadStatus, "reading">
) {
  const { error } = await db
    .from("reads")
    .update({ status, finished_at: new Date().toISOString().slice(0, 10) })
    .eq("id", readId);
  if (error) throw error;
}
