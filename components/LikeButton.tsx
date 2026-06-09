"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { likePost, unlikePost } from "@/lib/queries/likes";
import { AsteriskIcon } from "@/components/icons";
import { cn } from "@/components/ui";

export function LikeButton({
  postId,
  userId,
  initialLiked,
  initialCount,
}: {
  postId: string;
  userId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  async function toggle() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const supabase = createClient();
      if (next) await likePost(supabase, postId, userId);
      else await unlikePost(supabase, postId, userId);
    } catch {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm transition-all cursor-pointer select-none",
        liked ? "text-accent" : "text-ink-faint hover:text-accent"
      )}
    >
      <AsteriskIcon
        width={17}
        height={17}
        strokeWidth={liked ? 2.75 : 1.75}
        className={cn("transition-transform duration-200", liked && "rotate-[30deg] scale-110")}
      />
      {count > 0 && <span className="font-semibold">{count}</span>}
    </button>
  );
}
