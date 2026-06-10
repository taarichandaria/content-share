"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { unsavePost } from "@/lib/queries/saves";
import type { ContentType, SavedPost } from "@/lib/types/models";
import { TimeAgo } from "@/components/TimeAgo";
import { BookmarkIcon } from "@/components/icons";

const SECTIONS: Array<{ type: ContentType; label: string }> = [
  { type: "book", label: "Books" },
  { type: "article", label: "Articles" },
  { type: "paper", label: "Papers" },
  { type: "podcast", label: "Podcasts" },
  { type: "video", label: "Videos" },
  { type: "tweet", label: "Posts" },
  { type: "other", label: "Links" },
];

const byNewest = (a: SavedPost, b: SavedPost) =>
  b.created_at.localeCompare(a.created_at);

export function SavedList({ initial }: { initial: SavedPost[] }) {
  const [saves, setSaves] = useState(initial);

  async function remove(save: SavedPost) {
    setSaves((s) => s.filter((x) => x.post_id !== save.post_id));
    try {
      await unsavePost(createClient(), {
        postId: save.post_id,
        userId: save.user_id,
      });
    } catch {
      setSaves((s) => [...s, save].sort(byNewest));
    }
  }

  if (saves.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-4xl text-ink-faint" aria-hidden>
          &#10087;
        </p>
        <p className="commentary italic text-ink-soft mt-3 max-w-xs mx-auto">
          Nothing saved yet. Tap the bookmark on a post to keep what your
          friends share.
        </p>
      </div>
    );
  }

  const sections = SECTIONS.map(({ type, label }) => ({
    type,
    label,
    items: saves.filter((s) => s.post.content_item.type === type),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-9">
      {sections.map(({ type, label, items }) => (
        <section key={type}>
          <h2 className="smallcaps text-ink-soft flex items-baseline justify-between border-b border-line pb-2">
            {label}
            <span className="text-ink-faint">{items.length}</span>
          </h2>
          <ul className="divide-y divide-line/60">
            {items.map((save) => {
              const item = save.post.content_item;
              const author = save.post.author;
              return (
                <li
                  key={save.post_id}
                  className="flex items-start gap-3 py-4"
                >
                  <Link
                    href={`/posts/${save.post.id}`}
                    className="group min-w-0 flex-1"
                  >
                    <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-accent-deep transition-colors">
                      {item.title}
                    </h3>
                    {(item.site_name || item.creator) && (
                      <p className="smallcaps text-ink-faint mt-1">
                        {[item.site_name, item.creator]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="text-sm text-ink-soft italic mt-1.5 line-clamp-2">
                      &ldquo;{save.post.body}&rdquo;
                    </p>
                    <p className="text-xs text-ink-faint mt-1.5">
                      Shared by {author.display_name || author.username} ·
                      saved <TimeAgo date={save.created_at} />
                    </p>
                  </Link>
                  <button
                    onClick={() => remove(save)}
                    title="Remove from saved"
                    className="mt-1 text-gold hover:text-accent transition-colors cursor-pointer"
                  >
                    <BookmarkIcon width={18} height={18} fill="currentColor" />
                    <span className="sr-only">remove from saved</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
