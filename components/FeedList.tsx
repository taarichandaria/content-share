"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFeed, type FeedPage } from "@/lib/queries/posts";
import type { FeedPost } from "@/lib/types/models";
import { PostCard } from "@/components/PostCard";
import { Button, Spinner } from "@/components/ui";

export function FeedList({
  initial,
  userId,
  authorId,
  emptyNote = "Nothing here yet. Add some friends, or be the first to share.",
}: {
  initial: FeedPage;
  userId: string;
  /** When set, shows a single author's posts instead of the friends feed. */
  authorId?: string;
  emptyNote?: string;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);

  // Server refreshes (after composing, deleting elsewhere) replace the list.
  useEffect(() => {
    setPosts(initial.posts);
    setCursor(initial.nextCursor);
  }, [initial]);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const page = await getFeed(createClient(), userId, {
        before: cursor,
        authorId,
      });
      setPosts((p) => [...p, ...page.posts]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  function onDeleted(id: string) {
    setPosts((p) => p.filter((post) => post.id !== id));
  }

  if (posts.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-4xl text-ink-faint" aria-hidden>
          &#10087;
        </p>
        <p className="commentary italic text-ink-soft mt-3 max-w-xs mx-auto">
          {emptyNote}
        </p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post, i) => (
        <div key={post.id}>
          {i > 0 && (
            <div className="fleuron-rule" aria-hidden>
              <span className="text-xs">&#8258;</span>
            </div>
          )}
          <div
            className="rise-in"
            style={{ animationDelay: `${Math.min(i % 20, 8) * 50}ms` }}
          >
            <PostCard post={post} currentUserId={userId} onDeleted={onDeleted} />
          </div>
        </div>
      ))}
      {cursor && (
        <div className="flex justify-center py-6">
          <Button variant="secondary" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? <Spinner /> : "Older entries"}
          </Button>
        </div>
      )}
    </div>
  );
}
