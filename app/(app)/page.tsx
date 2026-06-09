import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/queries/posts";
import { getProfile } from "@/lib/queries/profiles";
import { Composer } from "@/components/Composer";
import { FeedList } from "@/components/FeedList";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, page] = await Promise.all([
    getProfile(supabase, user.id),
    getFeed(supabase, user.id),
  ]);
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6">
      <Composer profile={profile} />
      <FeedList initial={page} userId={user.id} />
    </div>
  );
}
