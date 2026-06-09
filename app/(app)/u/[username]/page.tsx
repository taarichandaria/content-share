import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername } from "@/lib/queries/profiles";
import { getFriendship } from "@/lib/queries/friends";
import { getFeed } from "@/lib/queries/posts";
import { listReads } from "@/lib/queries/reads";
import { Avatar } from "@/components/Avatar";
import { FriendButton } from "@/components/FriendButton";
import { FeedList } from "@/components/FeedList";
import { cn } from "@/components/ui";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) notFound();

  const isMe = profile.id === user.id;
  const [friendship, page, reads] = await Promise.all([
    isMe ? Promise.resolve(null) : getFriendship(supabase, user.id, profile.id),
    getFeed(supabase, user.id, { authorId: profile.id }),
    // RLS returns [] unless we're friends (or it's me).
    listReads(supabase, profile.id, "reading"),
  ]);

  const areFriends = isMe || friendship?.status === "accepted";

  return (
    <div>
      <header className="flex items-start gap-4 sm:gap-5">
        <Avatar
          username={profile.username}
          avatarUrl={profile.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
            {profile.display_name || profile.username}
          </h1>
          <p className="smallcaps text-ink-faint mt-1">@{profile.username}</p>
          {profile.bio && (
            <p className="commentary text-[15px] text-ink-soft mt-2">
              {profile.bio}
            </p>
          )}
        </div>
        {!isMe && (
          <FriendButton
            meId={user.id}
            otherId={profile.id}
            friendship={friendship}
          />
        )}
      </header>

      {reads.length > 0 && (
        <section className="mt-7">
          <h2 className="smallcaps text-ink-soft mb-2.5">
            {isMe ? "You are reading" : "Currently reading"}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {reads.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "smallcaps rounded-full border border-gold/40 bg-gold-soft text-gold px-3 py-1.5"
                )}
              >
                {r.content_item.title}
                {r.content_item.creator && ` — ${r.content_item.creator}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7 border-t border-line">
        {areFriends ? (
          <FeedList
            initial={page}
            userId={user.id}
            authorId={profile.id}
            emptyNote={
              isMe
                ? "You haven't shared anything yet."
                : "No entries from them yet."
            }
          />
        ) : (
          <div className="py-14 text-center">
            <p className="font-display text-4xl text-ink-faint" aria-hidden>
              &#10087;
            </p>
            <p className="commentary italic text-ink-soft mt-3 max-w-sm mx-auto">
              Their entries are between friends.
              {friendship?.status === "pending"
                ? " Your request is on its way."
                : " Send a request to read along."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
