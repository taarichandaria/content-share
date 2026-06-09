"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { addComment, deleteComment } from "@/lib/queries/comments";
import type { AuthorSummary, CommentWithAuthor } from "@/lib/types/models";
import { Avatar } from "@/components/Avatar";
import { TimeAgo } from "@/components/TimeAgo";
import { Button, Spinner, Textarea } from "@/components/ui";

export function Comments({
  postId,
  initial,
  me,
}: {
  postId: string;
  initial: CommentWithAuthor[];
  me: AuthorSummary;
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const comment = await addComment(createClient(), {
        postId,
        authorId: me.id,
        body: body.trim(),
      });
      setComments((c) => [...c, comment]);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    try {
      await deleteComment(createClient(), id);
    } catch {
      setComments(prev);
    }
  }

  return (
    <section className="mt-2">
      <h2 className="smallcaps text-ink-soft border-t border-line pt-5">
        Margin notes{comments.length > 0 && ` · ${comments.length}`}
      </h2>

      <ul className="mt-4 space-y-5">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Link href={`/u/${c.author.username}`} className="shrink-0 mt-0.5">
              <Avatar
                username={c.author.username}
                avatarUrl={c.author.avatar_url}
                size="sm"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-faint">
                <Link
                  href={`/u/${c.author.username}`}
                  className="font-semibold text-ink hover:text-accent-deep"
                >
                  {c.author.display_name || c.author.username}
                </Link>{" "}
                · <TimeAgo date={c.created_at} />
                {c.author_id === me.id && (
                  <>
                    {" · "}
                    <button
                      onClick={() => remove(c.id)}
                      className="hover:text-accent cursor-pointer"
                    >
                      remove
                    </button>
                  </>
                )}
              </p>
              <p className="commentary text-[15px] mt-1 whitespace-pre-wrap">
                {c.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-5 flex gap-3 items-start">
        <Avatar
          username={me.username}
          avatarUrl={me.avatar_url}
          size="sm"
          className="mt-1.5"
        />
        <div className="flex-1 space-y-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a note in the margin…"
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={busy || !body.trim()}>
              {busy ? <Spinner className="border-paper border-t-transparent" /> : "Note it"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
