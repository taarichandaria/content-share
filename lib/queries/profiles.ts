import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { Profile } from "@/lib/types/models";

type DB = SupabaseClient<Database>;

export async function getProfile(db: DB, id: string): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByUsername(
  db: DB,
  username: string
): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  db: DB,
  id: string,
  patch: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url">>
) {
  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}
