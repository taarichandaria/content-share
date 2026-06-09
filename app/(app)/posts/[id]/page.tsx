import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/queries/posts";
import { getProfile } from "@/lib/queries/profiles";
import { PostCard } from "@/components/PostCard";
import { Comments } from "@/components/Comments";

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [me, post] = await Promise.all([
    getProfile(supabase, user.id),
    // RLS hides posts from non-friends, so unauthorized ids 404 naturally.
    getPost(supabase, id).catch(() => null),
  ]);
  if (!me) redirect("/login");
  if (!post) notFound();

  return (
    <div>
      <Link
        href="/"
        className="smallcaps text-ink-faint hover:text-ink transition-colors"
      >
        &larr; Back to the feed
      </Link>
      <PostCard post={post} currentUserId={user.id} detail />
      <Comments postId={post.id} initial={post.comments} me={me} />
    </div>
  );
}
