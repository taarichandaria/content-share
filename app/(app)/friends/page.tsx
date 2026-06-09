import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listFriendships } from "@/lib/queries/friends";
import { FriendsTabs } from "@/components/FriendsTabs";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const entries = await listFriendships(supabase, user.id);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-4">
        The circle
      </h1>
      <FriendsTabs meId={user.id} entries={entries} />
    </div>
  );
}
