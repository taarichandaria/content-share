import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/queries/profiles";
import { listFriendships } from "@/lib/queries/friends";
import { Nav } from "@/components/Nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, friendships] = await Promise.all([
    getProfile(supabase, user.id),
    listFriendships(supabase, user.id),
  ]);
  if (!profile) redirect("/login");

  const pendingCount = friendships.filter(
    (f) => f.friendship.status === "pending" && f.incoming
  ).length;

  return (
    <div>
      <Nav profile={profile} pendingCount={pendingCount} />
      <main className="lg:pl-60 pb-20 lg:pb-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-6 lg:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
