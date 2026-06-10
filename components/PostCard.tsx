"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeedPost, PostDetail } from "@/lib/types/models";
import { createClient } from "@/lib/supabase/client";
import { deletePost } from "@/lib/queries/posts";
import { Avatar } from "@/components/Avatar";
import { ContentCard } from "@/components/ContentCard";
import { TimeAgo } from "@/components/TimeAgo";
import { CommentIcon } from "@/components/icons";

function commentCount(post: FeedPost | PostDetail): number {
  const c = post.comments as unknown as Array<{ count?: number }>;
  if (c.length > 0 && typeof c[0]?.count === "number") return c[0].count;
  return c.length;
}

export function PostCard({
  post,
  currentUserId,
  onDeleted,
  detail = false,
}: {
  post: FeedPost | PostDetail;
  currentUserId: string;
  onDeleted?: (id: string) => void;
  detail?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mine = post.author_id === currentUserId;

  async function remove() {
    setDeleting(true);
    try {
      await deletePost(createClient(), post.id);
      if (onDeleted) onDeleted(post.id);
      else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <article className="py-6">
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.author.username}`}>
          <Avatar
            username={post.author.username}
            avatarUrl={post.author.avatar_url}
          />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link
            href={`/u/${post.author.username}`}
            className="font-semibold text-[15px] hover:text-accent-deep transition-colors"
          >
            {post.author.display_name || post.author.username}
          </Link>
          <p className="text-xs text-ink-faint mt-0.5">
            @{post.author.username} · <TimeAgo date={post.created_at} />
          </p>
        </div>
        {post.read_id && (
          <span className="smallcaps shrink-0 rounded-full bg-gold-soft text-gold px-2.5 py-1 border border-gold/30">
            {/* Snapshot from the post row, not the read's live state. */}
            {post.progress ? `Reading · ${post.progress}` : "Reading"}
          </span>
        )}
      </header>

      <div className="commentary mt-3 whitespace-pre-wrap">{post.body}</div>

      <div className="mt-3.5">
        <ContentCard item={post.content_item} />
      </div>

      <footer className="mt-3.5 flex items-center gap-5">
        {detail ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
            <CommentIcon width={16} height={16} />
            {commentCount(post) > 0 && (
              <span className="font-semibold">{commentCount(post)}</span>
            )}
          </span>
        ) : (
          <Link
            href={`/posts/${post.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors"
          >
            <CommentIcon width={16} height={16} />
            {commentCount(post) > 0 && (
              <span className="font-semibold">{commentCount(post)}</span>
            )}
            <span className="sr-only">comments</span>
          </Link>
        )}
        {mine && (
          <span className="ml-auto text-xs">
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="text-accent font-semibold cursor-pointer"
                >
                  {deleting ? "Removing…" : "Yes, remove"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-ink-faint cursor-pointer"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-ink-faint hover:text-accent transition-colors cursor-pointer"
              >
                Remove
              </button>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}
