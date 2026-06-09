import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FriendEntry, Friendship, AuthorSummary } from "@/lib/types/models";

type DB = SupabaseClient<Database>;

/**
 * Friendships are stored as ONE canonical row per pair with user_a < user_b.
 * Postgres compares uuids by byte value, which for lowercase hex text equals
 * lexicographic order — so a plain string compare matches the DB constraint.
 * Every read/write of the friendships table must go through this helper.
 */
export function canonicalPair(x: string, y: string) {
  const a = x.toLowerCase();
  const b = y.toLowerCase();
  if (a === b) throw new Error("cannot friend yourself");
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

const ENTRY_SELECT = `
  *,
  profile_a:profiles!friendships_user_a_fkey(id, username, display_name, avatar_url),
  profile_b:profiles!friendships_user_b_fkey(id, username, display_name, avatar_url)
`;

type FriendshipRowWithProfiles = Friendship & {
  profile_a: AuthorSummary;
  profile_b: AuthorSummary;
};

function toEntry(row: FriendshipRowWithProfiles, me: string): FriendEntry {
  const otherIsA = row.user_a !== me;
  return {
    friendship: row,
    profile: otherIsA ? row.profile_a : row.profile_b,
    incoming: row.requester_id !== me,
  };
}

/** All friendship rows involving me (accepted + pending, both directions). */
export async function listFriendships(db: DB, me: string): Promise<FriendEntry[]> {
  const { data, error } = await db
    .from("friendships")
    .select(ENTRY_SELECT)
    .or(`user_a.eq.${me},user_b.eq.${me}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as FriendshipRowWithProfiles[]).map((r) =>
    toEntry(r, me)
  );
}

export async function getFriendship(
  db: DB,
  me: string,
  other: string
): Promise<Friendship | null> {
  const pair = canonicalPair(me, other);
  const { data, error } = await db
    .from("friendships")
    .select("*")
    .eq("user_a", pair.user_a)
    .eq("user_b", pair.user_b)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function sendFriendRequest(db: DB, me: string, other: string) {
  const pair = canonicalPair(me, other);
  const { error } = await db
    .from("friendships")
    .insert({ ...pair, requester_id: me });
  if (error) throw error;
}

export async function acceptFriendRequest(db: DB, me: string, other: string) {
  const pair = canonicalPair(me, other);
  const { error } = await db
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_a", pair.user_a)
    .eq("user_b", pair.user_b);
  if (error) throw error;
}

/** Cancel an outgoing request, decline an incoming one, or unfriend. */
export async function removeFriendship(db: DB, me: string, other: string) {
  const pair = canonicalPair(me, other);
  const { error } = await db
    .from("friendships")
    .delete()
    .eq("user_a", pair.user_a)
    .eq("user_b", pair.user_b);
  if (error) throw error;
}

/** Username / display-name search, excluding myself. */
export async function searchProfiles(
  db: DB,
  me: string,
  query: string
): Promise<AuthorSummary[]> {
  const q = query.replace(/[%_,()]/g, "").trim();
  if (q.length < 2) return [];
  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq("id", me)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}
